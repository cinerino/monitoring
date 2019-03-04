"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 測定データ報告
 */
const createDebug = require("debug");
const Controller = require("../../../controller/reportStockTelemetry");
const debug = createDebug('sskts-monitoring-jobs');
Controller.main()
    .then(() => {
    debug('success!');
})
    .catch((err) => {
    // tslint:disable-next-line:no-console
    console.error(err);
    process.exit(1);
});
