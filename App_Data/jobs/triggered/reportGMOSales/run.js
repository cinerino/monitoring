"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * GMO実売上状況を報告する
 * @ignore
 */
const createDebug = require("debug");
const Controller = require("../../../../controller/reportGMOSales");
const debug = createDebug('sskts-monitoring-jobs:reportGMOSales:run');
Controller.main().then(() => {
    debug('success!');
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
