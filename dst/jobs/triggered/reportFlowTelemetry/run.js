"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 測定データ報告
 */
const createDebug = require("debug");
const Controller = require("../../../controller/reportFlowTelemetry");
const debug = createDebug('cinerino-monitoring');
Controller.main()
    .then(() => {
    debug('success!');
})
    .catch((err) => {
    // tslint:disable-next-line:no-console
    console.error(err);
    process.exit(1);
});
