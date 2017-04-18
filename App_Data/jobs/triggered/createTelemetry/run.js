"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 測定データを作成する
 *
 * @ignore
 */
const createDebug = require("debug");
const Controller = require("../../../../controller/createTelemetry");
const debug = createDebug('sskts-reportjobs:jobs:createTelemetry:run');
Controller.main().then(() => {
    debug('success!');
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
