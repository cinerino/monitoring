/**
 * 測定データ報告テスト
 * todo テストコードが不完全
 *
 * @ignore
 */

// import * as sskts from '@motionpicture/sskts-domain';
// import * as moment from 'moment';
import * as mongoose from 'mongoose';
// import * as _ from 'underscore';

import * as ReportTelemetryController from '../controller/reportTelemetry';

describe('測定データ報告', () => {
    before((done) => {
        mongoose.disconnect().then(async () => {
            done();
        });
    });

    it('ok', async () => {
        await ReportTelemetryController.main();
    });
});
