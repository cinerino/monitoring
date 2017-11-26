/**
 * 注文シナリオをランダムに実行し続ける
 * @ignore
 */

import * as sskts from '@motionpicture/sskts-domain';
import * as createDebug from 'debug';

import * as processPlaceOrder from '../../../../controller/scenarios/processPlaceOrder';
import mongooseConnectionOptions from '../../../../mongooseConnectionOptions';

const debug = createDebug('sskts-monitoring-jobs');

sskts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);
const organizationRepo = new sskts.repository.Organization(sskts.mongoose.connection);
organizationRepo.searchMovieTheaters({})
    .then((movieTheaters) => {
        movieTheaters.forEach((movieTheater) => {
            if (process.env.NODE_ENV === 'production') {
                return;
            }

            setInterval(
                () => {
                    // 0-60秒の間でランダムにインターバルを置いてシナリオを実行する
                    // tslint:disable-next-line:insecure-random no-magic-numbers
                    const interval = Math.floor(60000 * Math.random());

                    setTimeout(
                        async () => {
                            try {
                                // tslint:disable-next-line:insecure-random no-magic-numbers
                                const duration = Math.floor(500000 * Math.random() + 300000);
                                const result = await processPlaceOrder.main(movieTheater.location.branchCode, duration);
                                debug('result:', result, 'movieTheater.branchCode:', movieTheater.branchCode);
                            } catch (error) {
                                console.error(error, 'movieTheater.branchCode:', movieTheater.branchCode);
                            }
                        },
                        interval
                    );
                },
                // tslint:disable-next-line:no-magic-numbers
                60000
            );
        });
    });
