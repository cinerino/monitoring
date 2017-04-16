"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 取引ステータス集計を報告する
 *
 * @ignore
 */
const createDebug = require("debug");
const Controller = require("../../../../controller/reportTransactionStatuses");
const debug = createDebug('sskts-reportjobs:jobs:reportTransactionStatuses:run');
Controller.main().then(() => {
    debug('success!');
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
