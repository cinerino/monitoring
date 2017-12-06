/**
 * 注文シナリオリクエストを実行する
 * @ignore
 */

import * as sskts from '@motionpicture/sskts-domain';
import * as createDebug from 'debug';
import * as json2csv from 'json2csv';
import * as moment from 'moment';
import * as request from 'request-promise-native';
import { setInterval } from 'timers';

import * as processPlaceOrder from '../../../../controller/scenarios/processPlaceOrder';

const debug = createDebug('sskts-monitoring-jobs');

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
}

interface IResult {
    processNumber: string;
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
    numberOfTrials: (process.argv[2] !== undefined) ? parseInt(process.argv[2], 10) : 10,
    // tslint:disable-next-line:no-magic-numbers
    intervals: (process.argv[3] !== undefined) ? parseInt(process.argv[3], 10) : 1000,
    // tslint:disable-next-line:no-magic-numbers
    sellerBranchCodes: (process.argv[4] !== undefined) ? process.argv[4].split(',') : ['112', '118'],
    apiEndpoint: <string>process.env.SSKTS_API_ENDPOINT
});

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
                // tslint:disable-next-line:insecure-random no-magic-numbers
                // const duration = Math.floor(500000 * Math.random() + 300000);
                const duration = 30;
                const { transaction, order, numberOfTryAuthorizeCreditCard } = await processPlaceOrder.main(sellerBranchCode, duration);
                result = {
                    processNumber: processNumber.toString(),
                    transactionId: transaction.id,
                    startDate: now.toISOString(),
                    errorMessage: '',
                    errorStack: '',
                    errorName: '',
                    errorCode: '',
                    orderNumber: order.orderNumber,
                    orderDate: order.orderDate.toString(),
                    paymentMethod: order.paymentMethods.map((paymentMethod) => paymentMethod.name).join(','),
                    paymentMethodId: order.paymentMethods.map((paymentMethod) => paymentMethod.paymentMethodId).join(','),
                    price: `${order.price.toString()} ${order.priceCurrency}`,
                    numberOfTryAuthorizeCreditCard: numberOfTryAuthorizeCreditCard.toString()
                };
            } catch (error) {
                result = {
                    processNumber: processNumber.toString(),
                    transactionId: '',
                    startDate: now.toISOString(),
                    errorMessage: error.message,
                    errorStack: error.stack,
                    errorName: error.name,
                    errorCode: error.code,
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
processNumber                    : ${result.processNumber}
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
async function reportResults(configurations: IConfigurations, results: any[]) {
    // sort result
    results = results.sort((a, b) => (a.processNumber > b.processNumber) ? 1 : -1);

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
    const url = await sskts.service.util.uploadFile({
        fileName: `sskts-report-loadtest-placeOrderTransactions-${moment().format('YYYYMMDDhhmmss')}.csv`,
        text: csv,
        // tslint:disable-next-line:no-magic-numbers
        expiryDate: moment().add(3, 'months').toDate()
    })();

    const subject = 'Completion of SSKTS placeOrder transaction loadtest';
    const text = `## ${subject}
### Configurations
key  | value
------------- | -------------
intervals  | ${configurations.intervals}
number of trials  | ${configurations.numberOfTrials.toString()}
seller branch codes  | ${configurations.sellerBranchCodes.join(',')}
api endpoint  | ${configurations.apiEndpoint}
### Reports
- Please check out the csv report [here](${url}).
        `;

    const emailMessage = sskts.factory.creativeWork.message.email.create({
        identifier: 'identifier',
        sender: {
            name: 'SSKTS Report',
            email: 'noreply@example.com'
        },
        toRecipient: {
            name: 'motionpicture developers',
            email: 'hello@motionpicture.jp'
        },
        about: subject,
        text: text
    });
    await sskts.service.notification.sendEmail(emailMessage)();

    // backlogへ通知
    const users = await request.get(
        {
            url: `https://m-p.backlog.jp/api/v2/projects/SSKTS/users?apiKey=${process.env.BACKLOG_API_KEY}`,
            json: true
        }
    ).then((body: any[]) => body);

    debug('notifying', users.length, 'people on backlog...');
    await request.post(
        {
            url: `https://m-p.backlog.jp/api/v2/issues/SSKTS-621/comments?apiKey=${process.env.BACKLOG_API_KEY}`,
            form: {
                content: text,
                notifiedUserId: users.map((user) => user.id)
            }
        }
    );

    debug('posted to backlog.');
}
