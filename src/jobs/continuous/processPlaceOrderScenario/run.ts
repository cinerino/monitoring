/**
 * 注文シナリオをランダムに実行し続ける
 */
import * as cinerino from '@cinerino/domain';
import * as createDebug from 'debug';
import * as mongoose from 'mongoose';

import * as processPlaceOrder from '../../../controller/scenarios/processPlaceOrder';
import mongooseConnectionOptions from '../../../mongooseConnectionOptions';

const debug = createDebug('cinerino-monitoring');

if (process.env.RUN_CONTINUOUS_SCENARIOS !== '1') {
    process.exit(0);
}

debug('start executing scenarios...');

// tslint:disable-next-line:no-magic-numbers
const INTERVAL = Number(<string>process.env.CONTINUOUS_SCENARIOS_INTERVAL_IN_SECONDS) * 1000;
mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions)
    .then()
    // tslint:disable-next-line:no-console
    .catch(console.error);
const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
sellerRepo.search({})
    .then((movieTheaters) => {
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
                                // tslint:disable-next-line:no-console
                                console.error(error, 'movieTheater.branchCode:', branchCode);
                            }
                        },
                        executesAfter
                    );
                },
                INTERVAL
            );
        });
    })
    // tslint:disable-next-line:no-console
    .catch(console.error);
