"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 注文シナリオリクエストを実行する
 */
const cinerino = require("@cinerino/domain");
const createDebug = require("debug");
const json2csv = require("json2csv");
const moment = require("moment");
const request = require("request-promise-native");
const timers_1 = require("timers");
const processPlaceOrder = require("../../../controller/scenarios/processPlaceOrder");
const debug = createDebug('cinerino-monitoring');
startScenarios({
    // tslint:disable-next-line:no-magic-numbers
    numberOfTrials: (process.argv[2] !== undefined) ? Number(process.argv[2]) : 10,
    // tslint:disable-next-line:no-magic-numbers
    intervals: (process.argv[3] !== undefined) ? Number(process.argv[3]) : 1000,
    // tslint:disable-next-line:no-magic-numbers
    sellerBranchCodes: (process.argv[4] !== undefined) ? process.argv[4].split(',') : [
        '101', '102', '106', '107', '108', '109', '110', '112', '113', '114', '115', '116', '117', '118', '119', '120'
    ],
    apiEndpoint: process.env.API_ENDPOINT,
    // tslint:disable-next-line:no-magic-numbers
    minDurationInSeconds: (process.argv[5] !== undefined) ? Number(process.argv[5]) : 300,
    // tslint:disable-next-line:no-magic-numbers
    maxDurationInSeconds: (process.argv[6] !== undefined) ? Number(process.argv[6]) : 800,
    // tslint:disable-next-line:no-magic-numbers
    projectId: (process.argv[7] !== undefined) ? process.argv[7] : 'cinerino'
});
// tslint:disable-next-line:max-func-body-length
function startScenarios(configurations) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('Cannot start scenarios on a production environment.');
    }
    debug('starting scenarios...', configurations);
    const logs = [];
    const results = [];
    let numberOfProcesses = 0;
    const timer = timers_1.setInterval(() => __awaiter(this, void 0, void 0, function* () {
        // プロセス数が設定に達したらタイマー終了
        if (numberOfProcesses >= configurations.numberOfTrials) {
            clearTimeout(timer);
            return;
        }
        numberOfProcesses += 1;
        const processNumber = numberOfProcesses;
        let log = '';
        let result;
        const now = new Date();
        // 販売者をランダムに選定
        // tslint:disable-next-line:insecure-random
        const sellerBranchCode = configurations.sellerBranchCodes[Math.floor(configurations.sellerBranchCodes.length * Math.random())];
        try {
            const durationInSeconds = Math.floor(
            // tslint:disable-next-line:insecure-random
            (configurations.maxDurationInSeconds - configurations.minDurationInSeconds) * Math.random()
                + configurations.minDurationInSeconds);
            const { progress, transaction, order, numberOfTryAuthorizeCreditCard } = yield processPlaceOrder.main({
                project: { id: configurations.projectId },
                theaterCode: sellerBranchCode,
                // tslint:disable-next-line:no-magic-numbers
                durationInMillisecond: durationInSeconds * 1000
            });
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
        }
        catch (error) {
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
            yield reportResults(configurations, results);
        }
    }), configurations.intervals);
}
/**
 * シナリオ結果をBacklogへ報告する
 */
function reportResults(configurations, scenarioResults) {
    return __awaiter(this, void 0, void 0, function* () {
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
        const url = yield cinerino.service.util.uploadFile({
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
        const users = yield request.get({
            url: `https://m-p.backlog.jp/api/v2/projects/CINERINO/users?apiKey=${process.env.BACKLOG_API_KEY}`,
            json: true
        })
            .then((body) => body);
        debug('notifying', users.length, 'people on backlog...');
        yield request.post({
            url: `https://m-p.backlog.jp/api/v2/issues/CINERINO-573/comments?apiKey=${process.env.BACKLOG_API_KEY}`,
            form: {
                content: text,
                notifiedUserId: users.map((user) => user.id)
            }
        })
            .promise();
        debug('posted to backlog.');
    });
}
