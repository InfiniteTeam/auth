# 운영 문서

백업/복구, secret rotation, health check, 장애 대응(runbook)을 다룹니다.

## 백업

### PostgreSQL 백업

`scripts/backup.sh`가 논리 백업(dump)을 생성합니다.

```bash
./scripts/backup.sh
```

- 출력: `backups/` 디렉터리에 다음 두 개 파일 생성
  - `kratos_<timestamp>.sql.gz`
  - `hydra_<timestamp>.sql.gz` (같은 Postgres 서버의 별도 database)
- `.gitignore`에 `backups/`, `*.sql.gz`가 포함되어 있어 Git에 올라가지 않습니다.

> 백업 범위에는 DB 외에도 다음을 포함하세요:
> - `config/` (kratos/hydra/portal 설정)
> - `.env` (비밀값) — 별도 secret store
> - Hydra JWK signing key (DB에 저장되지만 백업에 포함)
> - Identity schema

### 복구 (restore drill)

`scripts/restore.sh`는 staging DB에 복구를 수행합니다.

```bash
./scripts/restore.sh <timestamp>    # 예: ./scripts/restore.sh 20240101_120000
```

> ⚠️ restore는 대상 DB를 덮어씁니다. 스크립트가 확인 프롬프트를 출력하며 진행을 중단할 수도 있습니다.

`restore.sh`는 `kratos_<timestamp>.sql.gz`와 `hydra_<timestamp>.sql.gz`를 각각 복구하고 kratos/hydra/portal을 재시작합니다.

**/**
매주 1회 staging에서 restore drill을 수행하세요. 실제 복구 후 반드시:
1. 이메일 로그인이 되는지
2. OIDC token이 발급되는지 (discovery + Portainer 로그인)
3. 기존 데이터가 유실되지 않았는지

복구 절차:
```bash
# staging에서 전체 중지
docker compose -f compose.yaml -f compose.staging.yaml down
# DB 볼륨 제거 (주의: 백업에서 복구하는 경우만!)
docker compose -f compose.yaml -f compose.staging.yaml rm -v postgres
# DB만 다시 올리고 복구
docker compose -f compose.yaml -f compose.staging.yaml up -d postgres
gunzip -c <backup>.sql.gz | docker compose exec -T postgres psql -U kratos
```

## Health check

`scripts/healthcheck.sh`를 cron으로 주기 실행하거나 모니터링에서 호출하세요.

```bash
./scripts/healthcheck.sh
```

내부 관찰 endpoint:
- Portal: `http://portal:3000/health`
- Kratos ready: `http://kratos:4434/health/ready` (HTTP + DB 상태)
- Hydra ready: `http://hydra:4445/health/ready`

외부 공개 endpoint:
- `https://id.inft.kr/health`
- `https://auth.inft.kr/.well-known/openid-configuration`

공개 endpoint는 HTTP 200이면 정상. 실패 알림(예: 이메일/Webhook)을 붙이는 것을 권장합니다.

## Secret 관리

### 생성

```bash
./scripts/generate-secrets.sh     # .env 생성 + 대칭 secret 5종 자동 생성
./scripts/register-portainer.sh   # OIDC client secret 생성/표시
```

대칭 secret은 전부 32바이트 랜덤입니다.

### 보관 원칙

- production secret은 `.env`(권한 600) 또는 secret store에만.
- **Git / Notion / 채팅에 평문으로 기록 금지.**
- OAuth app secret과 Discord bot token은 provider dashboard + password manager에서 관리.

### Secret rotation 절차

> 무계획 rotation은 전체 로그아웃이나 복구 불능을 유발할 수 있습니다. 각 secret이 어디에 쓰이는지 먼저 확인하세요.

| Secret | 영향 | rotation 시 주의 |
|--------|------|------------------|
| `POSTGRES_PASSWORD` | DB 접근 | 양쪽(compose, DSN) 일치 필요. Kratos/Hydra/Portal 재시작 |
| `KRATOS_COOKIE_SECRET` | 브라우저 세션 쿠키 서명 | 변경 시 모든 사용자 로그아웃 |
| `KRATOS_CIPHER_SECRET` | identity 암호화 필드 | 변경 시 복구 불능 위험. 신중히 |
| `HYDRA_SYSTEM_SECRET` | 세션/쿠키 서명 | 변경 시 모든 OAuth 세션 무효화 |
| `PORTAL_COOKIE_SECRET` | Portal 세션 | 변경 시 Portal 세션 무효화 |
| OAuth client secret | OIDC 서비스 인증 | 서비스 UI(예: Portainer)와 함께 교체 |

Kratos/Hydra 시스템 secret은 배열 회전이 지원됩니다. 첫 항목으로 sign/encrypt하고, 전체 배열로 verify/decrypt하므로 **기존 secret을 즉시 삭제하지 말고** 배열에 새 값을 추가한 뒤 충분한 시간 후 옛 값을 제거하세요.

### OAuth client secret 유출 시

1. 해당 클라이언트를 즉시 비활성화하거나 secret을 rotate.
2. 관련 access/refresh token 철회 범위 판단.
3. redirect URI와 consent 기록 점검.
4. 영향 서비스 재로그인 요구.
5. 원인·재발 방지 조치 기록.

## Incident Runbook

### 팀원 퇴사 / 제외

1. Discord 서버에서 제외 또는 승인 role 제거.
2. Portal에서 Kratos identity를 비활성화(`state: inactive`).
3. Kratos 세션 + Hydra refresh token 철회.
4. 고위험 서비스의 기존 세션 정책 확인.
5. 감사 로그에 담당자·사유·시각 기록.

Kratos identity 비활성화 (admin API):
```bash
curl -X PATCH http://kratos:4434/admin/identities/<id> \
  -H 'Content-Type: application/json' \
  -d '[{"op":"replace","path":"/state","value":"inactive"}]'
```

세션 철회:
```bash
curl -X DELETE http://kratos:4434/admin/identities/<id>/sessions
```

Hydra refresh token 철회 (해당 클라이언트):
```bash
docker compose exec -T hydra hydra revoke token --endpoint http://127.0.0.1:4445 --token <refresh_token>
```

### Discord API 장애

- Discord API 오류를 "멤버임"으로 간주하지 않습니다. (fail closed)
- 신규 로그인은 차단됩니다.
- 이미 인증된 세션은 짧은 유예 정책을 별도로 정합니다.
- 운영자가 emergency group을 부여하는 절차를 문서화합니다. (기본: 승인 role 부여만으로 처리)

### 모든 서비스 장애 / 전체 재배포

```bash
cd ~/auth-inft
docker compose logs --tail=200 cloudflared kratos hydra portal postgres
# 마이그레이션 필요 확인 후
./scripts/migrate.sh
docker compose up -d
```

### 백업 복구 후 검증

```
# DB restore 후 반드시
curl -fsS https://auth.inft.kr/.well-known/openid-configuration   # issuer 확인
./scripts/healthcheck.sh
# 사용자 이메일 로그인 + Portainer OIDC 로그인으로 end-to-end 확인
```

## 모니터링 지표 (권장)

- Kratos/Hydra/Portal health 성공률
- login success/failure, provider별 오류
- Discord membership 거부 수
- OAuth authorization/token error 수
- PostgreSQL connection, disk, backup 성공 여부
- cloudflared tunnel 연결 상태 (origin 연결 유실 감지) — `docker compose logs cloudflared`로 `Registered tunnel connection` 확인
- TLS는 Cloudflare edge가 자동 관리 (수동 갱신 불필요)

로그에는 password, OAuth code, access token, refresh token, client secret, Discord bot token을 남기지 마세요. identity UUID와 request ID로 추적합니다.

## 참고

- [README.md](../README.md)
- [architecture.md](architecture.md)
- [deployment.md](deployment.md)
