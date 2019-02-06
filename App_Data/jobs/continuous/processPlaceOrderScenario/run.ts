/**
 * 注文シナリオをランダムに実行し続ける
 */
import * as sskts from '@motionpicture/sskts-domain';
import * as createDebug from 'debug';
import * as mongoose from 'mongoose';

import * as processPlaceOrder from '../../../../controller/scenarios/processPlaceOrder';
import mongooseConnectionOptions from '../../../../mongooseConnectionOptions';

const debug = createDebug('sskts-monitoring-jobs');

if (process.env.CONTINUOUS_SCENARIOS_STOPPED === '1') {
    process.exit(0);
}

debug('start executing scenarios...');

// tslint:disable-next-line:no-magic-numbers
const INTERVAL = parseInt(<string>process.env.CONTINUOUS_SCENARIOS_INTERVAL_IN_SECONDS, 10) * 1000;
mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);
const sellerRepo = new sskts.repository.Seller(mongoose.connection);
sellerRepo.search({}).then((movieTheaters) => {
    movieTheaters.forEach((movieTheater) => {
        setInterval(
            () => {
                // 0-{INTERVAL}の間でランダムにインターバルを置いてシナリオを実行する
                // tslint:disable-next-line:insecure-random no-magic-numbers
                const executesAfter = Math.floor(INTERVAL * Math.random());

                setTimeout(
                    async () => {
                        const branchCode = (<any>movieTheater.location).branchCode;

                        try {
                            // tslint:disable-next-line:insecure-random no-magic-numbers
                            const duration = Math.floor(Math.random() * 500000 + 300000);
                            const result = await processPlaceOrder.main(branchCode, duration);
                            debug('result:', result, 'movieTheater.branchCode:', branchCode);
                        } catch (error) {
                            console.error(error, 'movieTheater.branchCode:', branchCode);
                        }
                    },
                    executesAfter
                );
            },
            INTERVAL
        );
    });
});
