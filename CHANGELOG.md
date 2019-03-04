# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/).

## Unreleased

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security

## v5.1.0 - 2019-03-04

### Added

- 承認アクション分析タスクを追加

### Changed

- install @motionpicture/sskts-domain@30.0.0

## v5.0.2 - 2019-02-19

### Changed

- install @motionpicture/sskts-domain@29.x.x

## v5.0.1 - 2019-02-07

### Changed

- install @motionpicture/sskts-domain@28.0.0
- install @motionpicture/sskts-api-nodejs-client@6.0.0

## v5.0.0 - 2019-01-30

### Removed

- クレジットカード売上健康診断を削除
- クレジットカード売上報告を削除

## v4.2.2 - 2018-12-10

### Changed

- 注文取引シナリオ実行を全劇場に対応

## v4.2.1 - 2018-10-10

### Changed

- 監視報告スケジュールを調整。

## v4.2.0 - 2018-06-10

### Changed

- update packages.
- install sskts-domain@25.x.x

## v4.1.1 - 2018-05-02

### Fixed

- クレジットカード承認アクション集計のパフォーマンス改善(DBにインデックスを追加)

## v4.1.0 - 2018-03-05
### Added
- クレジットカードオーソリアクションデータ集計ジョブを追加。

### Changed
- update sskts-api-nodejs-client.
- update sskts-domain.

## v4.0.2 - 2018-02-26
### Changed
- update sskts-domain.

## v4.0.1 - 2018-02-25
### Fixed
- タスク数集計でスロークエリが出ていたため、タスクコレクションのインデックスを最適化。

## v4.0.0 - 2018-02-24
### Added
- 座席予約の空席率集計ジョブを実験的に設置。

### Changed
- 継続シナリオの間隔を環境変数で設定できるように変更。
- 注文取引シナリオから、メール送信処理を削除。
- GMO売上健康診断の材料として、支払アクションを参照するように変更。
- 注文シナリオ実行設定に、最小購入セッション時間と最大購入セッション時間を追加。
- フローデータ報告内容に、全種類のタスク情報(動的に)が含まれるように変更。

## v3.2.1 - 2017-12-19
### Fixed
- チャート画像が上書きされるバグ解消。

## v3.2.0 - 2017-12-18
### Added
- 継続的なシナリオを止めるフラグを環境変数に設定。
- 注文取引シナリオ実行時の設定項目を追加。

### Changed
- 注文取引シナリオ実行後のメール送信をオフに。
- フローデータ報告のx軸ラベルを時間表記に変更。
- 取引成立率を取引離脱具合の表示に変更。
- タスクのフローデータをタスク名別に集計するように変更。

## v3.1.0 - 2017-12-04
### Added
- 注文シナリオリクエストをAPIに投げるジョブを追加。
- 本番以外の環境において、継続的に注文シナリオを実行するジョブを追加。
- 取引成立率の報告を追加。
- 取引確定日時とイベント開始日時の差の報告を追加。

### Changed
- 測定データをグローバルスコープと販売者スコープに判別。
- チャートの表示有効期間を環境変数で設定できるように対応。

## v3.0.2 - 2017-11-04
### Changed
- 測定データ報告の種類を追加。

## v3.0.1 - 2017-10-31
### Changed
- MongoDBのコレクションのいくつかのインデックスを追加。

## v3.0.0 - 2017-10-31
### Changed
- sskts-domain@v23(スキーマ一新)に対応。
