/**
 * 注文シナリオをランダムに実行し続ける
 * @ignore
 */

import * as createDebug from 'debug';

import * as processPlaceOrder from '../../../../controller/scenarios/processPlaceOrder';

const debug = createDebug('sskts-monitoring-jobs');

setInterval(
    () => {
        if (process.env.NODE_ENV === 'production') {
            return;
        }

        // 0-60秒の間でランダムにインターバルを置いてシナリオを実行する
        // tslint:disable-next-line:insecure-random no-magic-numbers
        const interval = Math.floor(60000 * Math.random());

        setTimeout(
            async () => {
                const theaterCodes = ['112', '118'];
                // tslint:disable-next-line:insecure-random
                const theaterCode = theaterCodes[Math.floor(theaterCodes.length * Math.random())];

                try {
                    const result = await processPlaceOrder.main(theaterCode);
                    debug('result:', result);
                } catch (error) {
                    console.error(error);
                }
            },
            interval
        );
    },
    // tslint:disable-next-line:no-magic-numbers
    500
);
