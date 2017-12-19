"use strict";
/**
 * GoogleチャートAPIコントローラー
 * @namespace controller.googleChart
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const sskts = require("@motionpicture/sskts-domain");
const createDebug = require("debug");
const moment = require("moment");
const request = require("request-promise-native");
const debug = createDebug('sskts-monitoring-jobs');
const GOOGLE_CHART_URL = 'https://chart.googleapis.com/chart';
function publishUrl(params) {
    return __awaiter(this, void 0, void 0, function* () {
        // google chart apiで画像生成
        const buffer = yield request.post({
            url: GOOGLE_CHART_URL,
            form: params,
            encoding: 'binary'
        }).then((body) => new Buffer(body, 'binary'));
        debug('creating block blob... buffer.length:', buffer.length);
        // 3ヵ月有効なブロブ
        return sskts.service.util.uploadFile({
            // tslint:disable-next-line:insecure-random no-magic-numbers
            fileName: `monitoring-jobs-google-chart-${moment().format('YYMMDDHHmmssSSS')}-${Math.floor(1000 * Math.random())}.png`,
            text: buffer,
            // tslint:disable-next-line:no-magic-numbers
            expiryDate: moment().add(parseInt(process.env.CHART_EXPIRES_IN_MONTH, 10), 'months').toDate()
        })();
    });
}
exports.publishUrl = publishUrl;
/**
 * URL短縮
 *
 * @param {string} originalUrl 元のURL
 * @returns {Promise<string>}
 */
// export async function shortenUrl(originalUrl: string): Promise<string> {
//     return await request.get({
//         url: 'https://is.gd/create.php',
//         qs: {
//             format: 'json',
//             url: originalUrl
//         },
//         json: true
//     }).then((body) => <string>body.shorturl);
// }
