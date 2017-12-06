"use strict";
/**
 * 注文シナリオリクエストを実行する
 * @ignore
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
const json2csv = require("json2csv");
const moment = require("moment");
const request = require("request-promise-native");
const timers_1 = require("timers");
const processPlaceOrder = require("../../../../controller/scenarios/processPlaceOrder");
const debug = createDebug('sskts-monitoring-jobs');
startScenarios({
    // tslint:disable-next-line:no-magic-numbers
    numberOfTrials: (process.argv[2] !== undefined) ? parseInt(process.argv[2], 10) : 10,
    // tslint:disable-next-line:no-magic-numbers
    intervals: (process.argv[3] !== undefined) ? parseInt(process.argv[3], 10) : 1000,
    // tslint:disable-next-line:no-magic-numbers
    sellerBranchCodes: (process.argv[4] !== undefined) ? process.argv[4].split(',') : ['112', '118'],
    apiEndpoint: process.env.SSKTS_API_ENDPOINT
});
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
            // tslint:disable-next-line:insecure-random no-magic-numbers
            // const duration = Math.floor(500000 * Math.random() + 300000);
            const duration = 30;
            const { transaction, order, numberOfTryAuthorizeCreditCard } = yield processPlaceOrder.main(sellerBranchCode, duration);
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
        }
        catch (error) {
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
            yield reportResults(configurations, results);
        }
    }), configurations.intervals);
}
function reportResults(configurations, results) {
    return __awaiter(this, void 0, void 0, function* () {
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
        const url = yield sskts.service.util.uploadFile({
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
        yield sskts.service.notification.sendEmail(emailMessage)();
        // backlogへ通知
        const users = yield request.get({
            url: `https://m-p.backlog.jp/api/v2/projects/SSKTS/users?apiKey=${process.env.BACKLOG_API_KEY}`,
            json: true
        }).then((body) => body);
        debug('notifying', users.length, 'people on backlog...');
        yield request.post({
            url: `https://m-p.backlog.jp/api/v2/issues/SSKTS-621/comments?apiKey=${process.env.BACKLOG_API_KEY}`,
            form: {
                content: text,
                notifiedUserId: users.map((user) => user.id)
            }
        });
        debug('posted to backlog.');
    });
}
