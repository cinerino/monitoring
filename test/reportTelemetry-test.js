"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 測定データ報告テスト
 *
 * @ignore
 */
// import * as sskts from '@motionpicture/sskts-domain';
// import * as moment from 'moment';
const mongoose = require("mongoose");
// import * as _ from 'underscore';
const ReportTelemetryController = require("../controller/reportTelemetry");
describe('測定データ報告', () => {
    before((done) => {
        mongoose.disconnect().then(() => __awaiter(this, void 0, void 0, function* () {
            done();
        }));
    });
    it('ok', () => __awaiter(this, void 0, void 0, function* () {
        yield ReportTelemetryController.main();
    }));
});
