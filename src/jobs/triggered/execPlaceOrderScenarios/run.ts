/**
 * 注文シナリオリクエストを実行する
 */
import * as cinerino from '@cinerino/domain';
import * as createDebug from 'debug';
import * as json2csv from 'json2csv';
import * as moment from 'moment';
import * as request from 'request-promise-native';
import { setInterval } from 'timers';

import * as processPlaceOrder from '../../../controller/scenarios/processPlaceOrder';

const debug = createDebug('cinerino-monitoring');

interface IConfigurations {
    /**
     * 注文取引シナリオ数
     */
    numberOfTrials: number;
    /**
     * 各シナリオのリクエスト感覚
     */
    intervals: number;
    /**
     * 販売劇場枝番号リスト
     */
    sellerBranchCodes: string[];
    /**
     * APIエンドポイント
     */
    apiEndpoint: string;
    /**
     * 最小購入セッション時間
     */
    minDurationInSeconds: number;
    /**
     * 最大購入セッション時間
     */
    maxDurationInSeconds: number;
}

interface IResult {
    processNumber: number;
    progress: string;
    transactionId: string;
    startDate: string;
    errorMessage: string;
    errorStack: string;
    errorName: string;
    errorCode: string;
    orderNumber: string;
    orderDate: string;
    paymentMethod: string;
    paymentMethodId: string;
    price: string;
    numberOfTryAuthorizeCreditCard: string;
}

startScenarios({
    // tslint:disable-next-line:no-magic-numbers
    numberOfTrials: (process.argv[2] !== undefined) ? Number(process.argv[2]) : 10,
    // tslint:disable-next-line:no-magic-numbers
    intervals: (process.argv[3] !== undefined) ? Number(process.argv[3]) : 1000,
    // tslint:disable-next-line:no-magic-numbers
    sellerBranchCodes: (process.argv[4] !== undefined) ? process.argv[4].split(',') : [
        '101', '112', '116', '118', '119', '117', '114', '102', '106', '108', '107', '110', '109', '113', '115'
    ],
    apiEndpoint: <string>process.env.API_ENDPOINT,
    // tslint:disable-next-line:no-magic-numbers
    minDurationInSeconds: (process.argv[5] !== undefined) ? Number(process.argv[5]) : 300,
    // tslint:disable-next-line:no-magic-numbers
    maxDurationInSeconds: (process.argv[6] !== undefined) ? Number(process.argv[6]) : 800
});

// tslint:disable-next-line:max-func-body-length
function startScenarios(configurations: IConfigurations) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('Cannot start scenarios on a production environment.');
    }

    debug('starting scenarios...', configurations);

    const logs: string[] = [];
    const results: IResult[] = [];
    let numberOfProcesses = 0;

    const timer = setInterval(
        async () => {
            // プロセス数が設定に達したらタイマー終了
            if (numberOfProcesses >= configurations.numberOfTrials) {
                clearTimeout(timer);

                return;
            }

            numberOfProcesses += 1;
            const processNumber = numberOfProcesses;
            let log = '';
            let result: IResult;
            const now = new Date();

            // 販売者をランダムに選定
            // tslint:disable-next-line:insecure-random
            const sellerBranchCode = configurations.sellerBranchCodes[Math.floor(configurations.sellerBranchCodes.length * Math.random())];

            try {
                const durationInSeconds = Math.floor(
                    // tslint:disable-next-line:insecure-random
                    (configurations.maxDurationInSeconds - configurations.minDurationInSeconds) * Math.random()
                    + configurations.minDurationInSeconds
                );
                const { progress, transaction, order, numberOfTryAuthorizeCreditCard } = await processPlaceOrder.main(
                    // tslint:disable-next-line:no-magic-numbers
                    sellerBranchCode, durationInSeconds * 1000
                );
                result = {
                    processNumber: processNumber,
                    progress: progress,
                    transactionId: transaction.id,
                    startDate: now.toISOString(),
                    errorMessage: '',
                    errorStack: '',
                    errorName: '',
                    errorCode: '',
                    orderNumber: order.orderNumber,
                    orderDate: order.orderDate.toString(),
                    paymentMethod: order.paymentMethods.map((paymentMethod) => paymentMethod.name)
                        .join(','),
                    paymentMethodId: order.paymentMethods.map((paymentMethod) => paymentMethod.paymentMethodId)
                        .join(','),
                    price: `${order.price.toString()} ${order.priceCurrency}`,
                    numberOfTryAuthorizeCreditCard: numberOfTryAuthorizeCreditCard.toString()
                };
            } catch (error) {
                result = {
                    processNumber: processNumber,
                    progress: error.progress,
                    transactionId: '',
                    startDate: now.toISOString(),
                    errorMessage: error.message,
                    errorStack: error.stack,
                    errorName: error.name,
                    errorCode: (error.code !== undefined) ? error.code : '',
                    orderNumber: '',
                    orderDate: '',
                    paymentMethod: '',
                    paymentMethodId: '',
                    price: '',
                    numberOfTryAuthorizeCreditCard: ''
                };
            }

            log = `
=============================== Transaction result ===============================
processNumber                    : ${result.processNumber.toString()}
progress                         : ${result.progress}
transactionId                    : ${result.transactionId}
startDate                        : ${result.startDate}
errorMessage                     : ${result.errorMessage}
errorStack                       : ${result.errorStack}
errorName                        : ${result.errorName}
errorCode                        : ${result.errorCode}
orderNumber                      : ${result.orderNumber}
orderDate                        : ${result.orderDate}
paymentMethod                    : ${result.paymentMethod}
paymentMethodId                  : ${result.paymentMethodId}
price                            : ${result.price}
numberOfTryAuthorizeCreditCard   : ${result.numberOfTryAuthorizeCreditCard}
=============================== Transaction result ===============================`;
            debug(log);
            logs.push(log);
            results.push(result);

            // 全プロセスが終了したらレポートを送信
            if (results.length === numberOfProcesses) {
                await reportResults(configurations, results);
            }
        },
        configurations.intervals
    );
}
/**
 * シナリオ結果をBacklogへ報告する
 */
async function reportResults(configurations: IConfigurations, scenarioResults: IResult[]) {
    // sort result
    const results = scenarioResults.sort((a, b) => (a.processNumber > b.processNumber) ? 1 : -1);

    // csv作成
    const fields = Object.keys(results[0]);
    const fieldNames = Object.keys(results[0]);
    const csv = json2csv({
        data: results,
        fields: fields,
        fieldNames: fieldNames,
        del: ',',
        newLine: '\n',
        preserveNewLinesInValues: true
    });

    // upload csv
    const url = await cinerino.service.util.uploadFile({
        fileName: `cinerino-report-loadtest-placeOrderTransactions-${moment()
            .format('YYYYMMDDhhmmss')}.csv`,
        text: csv,
        expiryDate: moment()
            // tslint:disable-next-line:no-magic-numbers
            .add(3, 'months')
            .toDate()
    })();

    const subject = 'Completion of Cinerino PlaceOrder Transaction Loadtest';

    const numbersOfResult = {
        ok: results.filter((r) => r.orderNumber.length > 0).length,
        clientError: results.filter((r) => /^4\d{2}$/.test(r.errorCode)).length,
        serverError: results.filter((r) => /^5\d{2}$/.test(r.errorCode)).length,
        unknown: results.filter((r) => r.orderNumber.length === 0 && r.errorCode.length === 0).length
    };

    const HUNDRED = 100;
    const text = `## ${subject}
### Configurations
key  | value
------------- | -------------
intervals  | ${configurations.intervals}
number of trials  | ${configurations.numberOfTrials.toString()}
seller branch codes  | ${configurations.sellerBranchCodes.join(',')}
api endpoint  | ${configurations.apiEndpoint}
min duration  | ${configurations.minDurationInSeconds} seconds
max duration  | ${configurations.maxDurationInSeconds} seconds

### Summary
status | ratio | number of results
------------- | -------------
ok | ${Math.floor(HUNDRED * numbersOfResult.ok / results.length)}% | ${numbersOfResult.ok}/${results.length}
4xx  | ${Math.floor(HUNDRED * numbersOfResult.clientError / results.length)}% | ${numbersOfResult.clientError}/${results.length}
5xx  | ${Math.floor(HUNDRED * numbersOfResult.serverError / results.length)}% | ${numbersOfResult.serverError}/${results.length}
unknown | ${Math.floor(HUNDRED * numbersOfResult.unknown / results.length)}% | ${numbersOfResult.unknown}/${results.length}

### Reports
- Please check out the csv report [here](${url}).
        `;

    // const emailMessage = cinerino.factory.creativeWork.message.email.create({
    //     identifier: 'identifier',
    //     sender: {
    //         name: 'Cinerino Report',
    //         email: 'noreply@example.com'
    //     },
    //     toRecipient: {
    //         name: 'motionpicture developers',
    //         email: 'hello@motionpicture.jp'
    //     },
    //     about: subject,
    //     text: text
    // });
    // await cinerino.service.notification.sendEmail(emailMessage)();

    // backlogへ通知
    const users = await request.get(
        {
            url: `https://m-p.backlog.jp/api/v2/projects/SSKTS/users?apiKey=${process.env.BACKLOG_API_KEY}`,
            json: true
        }
    )
        .then((body: any[]) => body);

    debug('notifying', users.length, 'people on backlog...');
    await request.post(
        {
            url: `https://m-p.backlog.jp/api/v2/issues/SSKTS-621/comments?apiKey=${process.env.BACKLOG_API_KEY}`,
            form: {
                content: text,
                notifiedUserId: users.map((user) => user.id)
            }
        }
    )
        .promise();

    debug('posted to backlog.');
}
