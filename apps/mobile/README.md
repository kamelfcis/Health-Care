# Healthcare CRM Mobile

Production-oriented Flutter mobile app for the Healthcare CRM monorepo.

## Architecture

- Clean Architecture by feature (`data`, `domain`, `presentation`).
- Riverpod providers for dependency injection and state.
- Dio API layer with auth/refresh/logging interceptors.
- GoRouter route guards for authenticated navigation.
- Hive caching + flutter_secure_storage token persistence.

## Flavors

- `dev` -> `lib/main_dev.dart` + `.env.dev`
- `staging` -> `lib/main_staging.dart` + `.env.staging`
- `production` -> `lib/main_production.dart` + `.env.production`

## Run Commands

From repository root:

- `npm run dev:mobile`
- `flutter run --project-dir "apps/mobile" --flavor staging -t lib/main_staging.dart`
- `flutter run --project-dir "apps/mobile" --flavor production -t lib/main_production.dart`

## Build Commands

- `npm run build:mobile:apk`
- `npm run build:mobile:ios`

## Notes

- Base API URL is loaded from env files and should point to backend `/api`.
- The logo is configured from `assets/images/healthcare.jpeg`.
