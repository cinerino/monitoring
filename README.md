# 佐々木興行チケットシステムレポートジョブアプリケーション

# Features

# Getting Started

## インフラ
基本的にnode.jsのウェブアプリケーション。
ウェブサーバーとしては、AzureのWebApps or GCPのAppEngine or AWSのelastic beanstalkを想定。
全てで動くように開発していくことが望ましい。

## 言語
実態としては、linuxあるいはwindows上でのnode.js。
プログラミング言語としては、alternative javascriptのひとつであるTypeScript。

* TypeScript(https://www.typescriptlang.org/)

## 開発方法
npmでパッケージをインストール。

```shell
npm install
```
* npm(https://www.npmjs.com/)


typescriptをjavascriptにコンパイル。

```shell
npm run build -- -w
```


## Required environment variables
```shell
set NODE_ENV=**********環境名**********
set MONGOLAB_URI=**********mongodb接続URI**********
set SENDGRID_API_KEY=**********sendgrid api key**********
set GMO_ENDPOINT=**********gmo apiのエンドポイント**********
set COA_ENDPOINT=**********coa apiのエンドポイント**********
set COA_REFRESH_TOKEN=**********coa apiのリフレッシュトークン**********
set SSKTS_DEVELOPER_EMAIL=**********報告に使用される開発者メールアドレス**********
set SSKTS_DEVELOPER_LINE_NOTIFY_ACCESS_TOKEN=**********報告に使用されるLINE通知のアクセストークン**********
set STOCK_STATUS_REDIS_HOST=**********在庫状況保管用Redis Cacheホスト名**********
set STOCK_STATUS_REDIS_PORT=**********在庫状況保管用Redis Cacheポート番号**********
set STOCK_STATUS_REDIS_KEY=**********在庫状況保管用Redis Cache接続キー**********
```

only on Aure WebApps

```shell
set WEBSITE_NODE_DEFAULT_VERSION=**********node.jsバージョン=**********
set WEBSITE_TIME_ZONE=Tokyo Standard Time
```


# tslint

コード品質チェックをtslintで行う。
* [tslint](https://github.com/palantir/tslint)
* [tslint-microsoft-contrib](https://github.com/Microsoft/tslint-microsoft-contrib)

`npm run check`でチェック実行。改修の際には、必ずチェックすること。


# clean
`npm run clean`で不要なソース削除。


# test
`npm test`でチェック実行。


# versioning
`npm version patch -f -m "enter your commit comment..."`でチェック実行。
