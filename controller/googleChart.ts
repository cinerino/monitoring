/**
 * GoogleチャートAPIコントローラー
 * @namespace controller.googleChart
 */

import * as sskts from '@motionpicture/sskts-domain';
import * as createDebug from 'debug';
import * as moment from 'moment';
import * as request from 'request-promise-native';

const debug = createDebug('sskts-monitoring-jobs');
const GOOGLE_CHART_URL = 'https://chart.googleapis.com/chart';

export async function publishUrl(params: any) {
    // google chart apiで画像生成
    const buffer = await request.post({
        url: GOOGLE_CHART_URL,
        form: params,
        encoding: 'binary'
    }).then((body) => new Buffer(body, 'binary'));
    debug('creating block blob... buffer.length:', buffer.length);

    // 3ヵ月有効なブロブ
    return sskts.service.util.uploadFile({
        // tslint:disable-next-line:insecure-random no-magic-numbers
        fileName: `monitoring-jobs-google-chart-${moment().format('YYMMDDHHmmssSSS')}-${Math.floor(Math.random() * 1000)}.png`,
        text: buffer,
        // tslint:disable-next-line:no-magic-numbers
        expiryDate: moment().add(parseInt(<string>process.env.CHART_EXPIRES_IN_MONTH, 10), 'months').toDate()
    })();
}

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
