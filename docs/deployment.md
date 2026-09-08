# 배포 절차

이 문서는 개발/준비 서버에서 **staging 검증 → production 전환**까지의 실제 실행 명령을 순서대로 담고 있습니다. 전체 flow는 `compose.yaml`(production)과 `compose.staging.yaml`(staging 오버라이드)을 사용합니다.

> **중요**: 기존 서버/설정을 덮어쓰거나 삭제하지 않도록, 각 단계 전에 현재 상태를 먼저 확인하세요.

## 사전 요구 사항

- Ubuntu 24.04 LTS (arm64 권장)
- Docker Engine 29.x + Docker Compose v2.x 설치됨
- **Cloudflare Tunnel** 사용 (외부 인바운드 포트 불필요)
- Cloudflare:
  - `inft.kr` 존: `id.inft.kr`, `auth.inft.kr` → **CNAME `<tunnel-uuid>.cfargotunnel.com` (Proxied)**
  - staging용 `id.stg.inft.kr`, `auth.stg.inft.kr` (없으면 먼저 생성)
- `cloudflared` CLI 또는 Tunnel:Edit 권한이 있는 API 토큰 (Tunnel 생성용)
- GitHub OAuth App, Discord Application + Bot
- SMTP 서버 creds

## 0. Tunnel 생성 & DNS 준비

```bash
# cloudflared CLI 설치 (서버에서)
curl -L --output /tmp/cloudflared.deb \
  "https://github.com/cloudflare/cloudflared/releases/download/2026.8.2/cloudflared-linux-$(dpkg --print-architecture).deb"
sudo dpkg -i /tmp/cloudflared.deb

# 계정 로그인 (Tunnel:Edit 권한을 가진 토큰으로)
cloudflared tunnel login

# 로컬 관리형 tunnel 생성 -> TUNNEL_ID(UUID) 출력
cloudflared tunnel create identity
# ./cloudflared/credentials.json 가 자동 생성됨 (현재 시각 기준 기본 위치 ~/.cloudflared/)

# 생성된 credentials.json을 repo의 cloudflared/ 로 복사 (권한 600, Git 제외)
cp ~/.cloudflared/<tunnel-uuid>.json ./cloudflared/credentials.json
chmod 600 ./cloudflared/credentials.json

# cloudflared/config.yml 의 <TUNNEL_ID>를 실제 UUID로 치환
sed -i 's/<TUNNEL_ID>/<실제-UUID>/' ./cloudflared/config.yml
```

그 후 Cloudflare 대시보드(또는 DNS API)에서:
- `id.inft.kr` A → **CNAME `<tunnel-uuid>.cfargotunnel.com`** (Proxied)
- `auth.inft.kr` A → **CNAME `<tunnel-uuid>.cfargotunnel.com`** (Proxied)

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
SMTP_CONNECTION_URI=smtps://user:pass@smtp.inft.kr:465
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
# staging override를 사용해 기동 (마이그레이션 포함)
./scripts/start.sh --staging
# 또는 마이그레이션 없이 기동
./scripts/start.sh --staging --skip-migrate
docker compose -f compose.yaml -f compose.staging.yaml ps
docker compose -f compose.yaml -f compose.staging.yaml logs --tail=100 cloudflared kratos hydra portal
```

staging 검증 항목:
```bash
# cloudflared tunnel 연결 확인
docker compose -f compose.yaml -f compose.staging.yaml logs --tail=50 cloudflared
# Kratos health
curl -fsS https://id.stg.inft.kr/health          # Portal
curl -fsS https://id.stg.inft.kr/.kratos/health/ready  # Kratos ready
# Hydra discovery (issuer가 auth.stg.inft.kr인지)
curl -fsS https://auth.stg.inft.kr/.well-known/openid-configuration
# Hydra admin API가 차단되는지 (403 기대)
curl -s -o /dev/null -w '%{http_code}\n' https://auth.stg.inft.kr/admin/ignore
```

> Cloudflare에서 staging subdomain(`id.stg.inft.kr`, `auth.stg.inft.kr`)의 DNS 레코드를 먼저 **CNAME `<tunnel-uuid>.cfargotunnel.com` (Proxied)** 로 만들어야 합니다.

## 3. DB 마이그레이션

마이그레이션은 `start.sh`에 기본 포함되어 있어 처음 기동할 때 자동 실행됩니다. 별도로만 실행하려면:

```bash
cd ~/auth-inft
docker compose up -d postgres
docker compose exec postgres pg_isready -U kratos -d kratos

# Kratos 마이그레이션
docker compose exec kratos kratos -c /etc/config/kratos/kratos.yml migrate sql -e --yes

# Hydra 마이그레이션
docker compose exec hydra hydra -c /etc/config/hydra/hydra.yml migrate sql -e --yes
```

또는 번들 스크립트:
```bash
./scripts/migrate.sh
```

> 마이그레이션 실패 시 서비스 기동을 중단하고 로그를 확인하세요.

## 4. 전체 기동 (production)

```bash
./scripts/start.sh                 # postgres + 마이그레이션 + 전체 기동
# 마이그레이션 없이 재기동만:
./scripts/start.sh --skip-migrate
docker compose ps
docker compose logs --tail=100 cloudflared kratos hydra portal
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
- [ ] Cloudflare `id.inft.kr`·`auth.inft.kr` → CNAME `<tunnel-uuid>.cfargotunnel.com` (Proxied)
- [ ] discovery issuer가 `auth.inft.kr` (staging이 아님)
- [ ] 외부 인바운드 포트 없음 (80/443 닫힘 — Tunnel로만 공개)
- [ ] `docker compose ps` 전 서비스 healthy
- [ ] backup script 테스트 완료 ([operations.md](operations.md) 참고)

## 9. 문제 해결 (빠른 참조)

| 증상 | 확인 사항 |
|------|-----------|
| Tunnel 연결 안 됨 | `docker compose logs cloudflared` / `credentials.json`·`config.yml`의 tunnel UUID 일치 확인 |
| DNS가 서버가 아닌 곳으로 감 | `id`/`auth`가 CNAME `<tunnel-uuid>.cfargotunnel.com` (Proxied)인지 |
| Kratos unhealthy | `docker compose logs kratos` / **마이그레이션 실행 여부** |
| Hydra discovery 404 | Tunnel ingress `/.well-known`이 hydra로 가는지 / `/admin/*` 차단이 discovery를 가로막지 않았는지 |
| `auth/admin/*`가 200 | Tunnel ingress에서 `/admin/*` → `http_status:403` 확인 |
| 소셜 로그인 실패 | callback URL이 OAuth app에 정확히 등록됐는지 / `.env` 값 |
| Discord 거부 | 사용자가 target guild 구성원인지 / `DISCORD_BOT_TOKEN` 권한(`guilds.members.read`) |
| PKCE 400 | client가 `code_challenge`/`code_verifier`를 보내는지 |

## 참고

- [architecture.md](architecture.md) — 통신 구조, claim, 소셜 정책
- [operations.md](operations.md) — 백업/복구, secret rotation, runbook
