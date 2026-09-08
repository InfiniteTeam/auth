# 배포 절차

이 문서는 개발/준비 서버에서 **staging 검증 → production 전환**까지의 실제 실행 명령을 순서대로 담고 있습니다. 전체 flow는 `compose.yaml`(production)과 `compose.staging.yaml`(staging 오버라이드)을 사용합니다.

> **중요**: 기존 서버/설정을 덮어쓰거나 삭제하지 않도록, 각 단계 전에 현재 상태를 먼저 확인하세요.

## 사전 요구 사항

- Ubuntu 24.04 LTS (arm64 권장)
- Docker Engine 29.x + Docker Compose v2.x 설치됨
- UFW: SSH/80/443만 허용
- Cloudflare:
  - `id.inft.kr`, `auth.inft.kr` → **Proxied (오렌지 클라우드)**
  - **SSL/TLS Full (strict)** (Flexible 금지)
  - `id.stg.inft.kr`, `auth.stg.inft.kr` → staging용 (없으면 먼저 생성)
- GitHub OAuth App, Discord Application + Bot
- SMTP 서버 creds

## 0. 서버 상태 점검 (덮어쓰기 방지)

```bash
# 도메인 해석 확인
getent ahosts id.inft.kr
getent ahosts auth.inft.kr

# 기존 listen socket 확인 (80/443/5432/4433/4434/4444/4445)
sudo ss -lntp '( sport = :80 or sport = :443 or sport = :5432 or sport = :4433 or sport = :4434 or sport = :4444 or sport = :4445 )'

# Docker 아키텍처
docker info --format '{{.Architecture}}'
```

기대값:
- `id`/`auth`가 서버 공인 IP로 해석
- 배포 전에는 80/443 이외 인증 구성요소가 listen하지 않음
- 아키텍처: `aarch64` 또는 `arm64`

> 기존에 5432/4433/4434/4444/4445가 이미 listen 중이라면 **이미 배포된 서비스가 있을 수 있으므로** 계속하기 전에 확인하세요.

## 1. 저장소 복제 & secret 생성

```bash
# 서버에서
git clone git@github.com:InfiniteTeam/auth.git ~/auth-inft
cd ~/auth-inft
chmod +x scripts/*.sh

# .env 자동 생성 (대칭 secret 5종 자동 생성)
./scripts/generate-secrets.sh
```

`generate-secrets.sh`는 `.env.example`을 복사하고 다음을 자동 생성합니다:
- `POSTGRES_PASSWORD`
- `KRATOS_COOKIE_SECRET`
- `KRATOS_CIPHER_SECRET`
- `HYDRA_SYSTEM_SECRET`
- `PORTAL_COOKIE_SECRET`

이후 `.env`를 편집해 수동 값 입력:

```bash
nano .env
```

채워야 할 값:
```ini
GITHUB_CLIENT_ID=<github oauth app client_id>
GITHUB_CLIENT_SECRET=<github oauth app secret>
DISCORD_CLIENT_ID=<discord app client_id>
DISCORD_CLIENT_SECRET=<discord app secret>
DISCORD_BOT_TOKEN=<discord bot token>
DISCORD_GUILD_ID=<target discord server id>
SMTP_CONNECTION_URI=smtps://user:pass@smtp.example.com:465
```

> **보안**: `.env` 파일은 권한 600으로 유지하고 Git/Notion/채팅에 평문으로 노출하지 마세요.

## 2. Compose 문법 확인 전 staging

### 2.1 문법 검증

```bash
docker compose config --quiet && echo "compose OK"
docker compose -f compose.yaml -f compose.staging.yaml config --quiet && echo "staging OK"
```

### 2.2 staging 기동 (권장)

staging 도메인으로 검증:
```bash
# staging override를 사용해 기동
docker compose -f compose.yaml -f compose.staging.yaml up -d --build
docker compose -f compose.yaml -f compose.staging.yaml ps
docker compose -f compose.yaml -f compose.staging.yaml logs --tail=100 caddy kratos hydra portal
```

staging 검증 항목:
```bash
# Kratos health
curl -fsS https://id.stg.inft.kr/health          # Portal
curl -fsS https://id.stg.inft.kr/.kratos/health/ready  # Kratos ready
# Hydra discovery (issuer가 auth.stg.inft.kr인지)
curl -fsS https://auth.stg.inft.kr/.well-known/openid-configuration
```

> Cloudflare에서 staging subdomain(`id.stg.inft.kr`, `auth.stg.inft.kr`)의 DNS 레코드를 먼저 **Proxied + Full (strict)**로 만들어야 합니다.

## 3. DB 마이그레이션

```bash
cd ~/auth-inft
docker compose up -d postgres
docker compose exec postgres pg_isready -U kratos -d kratos

# Kratos 마이그레이션
docker compose exec kratos kratos migrate sql -e /etc/config/kratos/kratos.yml --yes

# Hydra 마이그레이션
docker compose exec hydra hydra migrate sql -e /etc/config/hydra/hydra.yml --yes
```

또는 번들 스크립트:
```bash
./scripts/migrate.sh
```

> 마이그레이션 실패 시 서비스 기동을 중단하고 로그를 확인하세요.

## 4. 전체 기동 (production)

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 caddy kratos hydra portal
./scripts/healthcheck.sh
```

기대 결과 (`healthcheck.sh`):
```
[OK]   Portal (HTTP 200)
[OK]   id.inft.kr (HTTP 200)
[OK]   auth.inft.kr (HTTP 200)
```

Hydra/Kratos admin이 내부에만 있어 host에서 직접 curl하는 항목은 `[SKIP]`으로 표시됩니다 (정상).

## 5. OIDC discovery 검증

```bash
curl -fsS https://auth.inft.kr/.well-known/openid-configuration | python3 -m json.tool
```

중요:
- `issuer`가 정확히 `https://auth.inft.kr`
- `authorization_endpoint`, `token_endpoint`, `jwks_uri`, `userinfo_endpoint`가 전부 `auth.inft.kr` 도메인을 가리키는지
- `end_session_endpoint` 존재

## 6. Portainer OIDC client 등록

```bash
./scripts/register-portainer.sh
```

출력된 `client_id` / `client_secret`을 password manager에 저장합니다.

## 7. Grafana 대신 다른 서비스 추가

새 OIDC client를 등록하려면 `register-portainer.sh`를 복제해 클라이언트명/redirect URI/scope를 바꿔 사용합니다.

```bash
docker compose exec -T hydra hydra create client \
  --endpoint http://127.0.0.1:4445 \
  --grant-type authorization_code,refresh_token \
  --response-type code,id_token \
  --scope openid,offline,offline_access,email,profile \
  --callback-uri "https://<service>/auth/callback" \
  --token-endpoint-auth-method client_secret_post \
  --name "<service>" \
  --id "<client_id>" \
  --secret "<client_secret>" \
  --format json
```

## 8. staging → production 전환 시 final check

production 전환 전 다음을 반드시 확인합니다:
- [ ] `.env`에 staging이 아닌 production OAuth app 값 (GitHub/Discord)이 들어있는지
- [ ] Cloudflare SSL **Full (strict)** / proxied 확인
- [ ] discovery issuer가 `auth.inft.kr` (staging이 아님)
- [ ] external 포트는 80/443뿐
- [ ] `docker compose ps` 전 서비스 healthy
- [ ] backup script 테스트 완료 ([operations.md](operations.md) 참고)

## 9. 문제 해결 (빠른 참조)

| 증상 | 확인 사항 |
|------|-----------|
| Caddy 인증서 발급 실패 | `docker compose logs caddy`의 ACME 오류 / Cloudflare proxied + 80/443 open |
| Kratos unhealthy | `docker compose logs kratos` / **마이그레이션 실행 여부** |
| Hydra discovery 404 | `/admin/*` 차단 라우팅이 discovery를 가로막지 않았는지 / `auth` host가 Hydra로 가는지 |
| 소셜 로그인 실패 | callback URL이 OAuth app에 정확히 등록됐는지 / `.env` 값 |
| Discord 거부 | 사용자가 target guild 구성원인지 / `DISCORD_BOT_TOKEN` 권한(`guilds.members.read`) |
| PKCE 400 | client가 `code_challenge`/`code_verifier`를 보내는지 |

## 참고

- [architecture.md](architecture.md) — 통신 구조, claim, 소셜 정책
- [operations.md](operations.md) — 백업/복구, secret rotation, runbook
