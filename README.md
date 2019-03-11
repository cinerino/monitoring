# Cinerino Monitoring

## Getting Started

### インフラ

基本的にNode.jsのウェブアプリケーション。

### Environment variables

| Name                                             | Required              | Value                 | Purpose                                |
| ------------------------------------------------ | --------------------- | --------------------- | -------------------------------------- |
| `DEBUG`                                          | false                 | cinerino-monitoring:* | Debug                                  |
| `NODE_ENV`                                       | true                  |                       | environment name                       |
| `MONGOLAB_URI`                                   | true                  |                       | MongoDB connection URI                 |
| `SENDGRID_API_KEY`                               | true                  |                       | SendGrid API Key                       |
| `GMO_ENDPOINT`                                   | true                  |                       | GMO API endpoint                       |
| `COA_ENDPOINT`                                   | true                  |                       | COA API endpoint                       |
| `COA_REFRESH_TOKEN`                              | true                  |                       | COA API refresh token                  |
| `DEVELOPER_EMAIL`                                | true                  |                       | 開発者通知用メールアドレス             |
| `DEVELOPER_LINE_NOTIFY_ACCESS_TOKEN`             | true                  |                       | LINE Notifyでのレポート通知            |
| `LINE_NOTIFY_URL`                                | true                  |                       | https://notify-api.line.me/api/notify  |
| `BACKLOG_API_KEY`                                | true                  |                       | バックログAPI key                      |
| `AZURE_STORAGE_CONNECTION_STRING`                | true                  |                       | Save charts on azure storage           |
| `CHART_EXPIRES_IN_MONTH`                         | true                  |                       | チャート表示有効期間(ヵ月)             |
| `SSKTS_CLIENT_ID`                                | true                  |                       | SSKTS APIクライアントID                |
| `SSKTS_CLIENT_SECRET`                            | true                  |                       | SSKTS APIクライアントシークレット      |
| `SSKTS_AUTHORIZE_SERVER_DOMAIN`                  | true                  |                       | SSKTS API認可サーバードメイン          |
| `SSKTS_ENDPOINT`                                 | true                  |                       | SSKTS APIエンドポイント                |
| `RUN_SSKTS_CONTINUOUS_SCENARIOS`                 | false                 | 1 or 0                | 継続的なシナリオ実行フラグ             |
| `SSKTS_CONTINUOUS_SCENARIOS_INTERVAL_IN_SECONDS` | true                  |                       | 継続的なシナリオ実行間隔               |
| `CREDIT_CARD_AUTH_AGGREGATION_PERIOD_IN_DAYS`    | true                  |                       | クレジットカード承認アクション集計期間 |
| `WEBJOBS_ROOT_PATH`                              | only on Azure WebApps | dst/jobs              |                                        |
| `WEBSITE_NODE_DEFAULT_VERSION`                   | only on Azure WebApps |                       | Node.js version                        |
| `WEBSITE_TIME_ZONE`                              | only on Azure WebApps |                       | Tokyo Standard Time                    |
