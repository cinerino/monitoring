"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * GMO実売上の健康診断を実施する
 *
 * @ignore
 */
const createDebug = require("debug");
const Controller = require("../../../../controller/checkHealthOfGMOSales");
const debug = createDebug('sskts-reportjobs:jobs:checkHealthOfGMOSales:run');
Controller.main().then(() => {
    debug('success!');
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
