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
 * クレジットカードオーソリアクションデータを集計する
 */
const cinerino = require("@cinerino/domain");
const createDebug = require("debug");
// import * as fs from 'fs';
const moment = require("moment");
const mongoose = require("mongoose");
const request = require("request-promise-native");
const mongooseConnectionOptions_1 = require("../../../mongooseConnectionOptions");
const debug = createDebug('cinerino-monitoring');
const SUBJECT = 'Credit Card Authorize Action Aggregation';
const HUNDRED = 100;
if (process.env.CREDIT_CARD_AUTH_AGGREGATION_PERIOD_IN_DAYS === undefined) {
    throw new Error('Environment variable \'CREDIT_CARD_AUTH_AGGREGATION_PERIOD_IN_DAYS\' required.');
}
const AGGREGATION_PERIOD_IN_DAYS = Number(process.env.CREDIT_CARD_AUTH_AGGREGATION_PERIOD_IN_DAYS);
// tslint:disable-next-line:max-func-body-length
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        // 一定期間のクレジットカード承認アクションを検索
        const aggregationStartThrough = new Date();
        const aggregationStartFrom = moment(aggregationStartThrough)
            .add(-AGGREGATION_PERIOD_IN_DAYS, 'day')
            .toDate();
        let sampleCount = 0;
        const numbersOfResult = {
            completed: 0,
            failed: 0,
            canceled: 0
        };
        let errorNamesSummary = [];
        let errorMessagesSummary = [];
        let contentSummary = [];
        let userMessagesSummary = [];
        debug('searching authorize actions...');
        const cursor = actionRepo.actionModel.find({
            startDate: {
                $gte: aggregationStartFrom,
                $lt: aggregationStartThrough
            },
            typeOf: cinerino.factory.actionType.AuthorizeAction,
            'object.typeOf': { $exists: true, $eq: cinerino.factory.action.authorize.paymentMethod.any.ResultType.Payment },
            'object.paymentMethod': { $exists: true, $eq: cinerino.factory.chevre.paymentMethodType.CreditCard }
        })
            .cursor();
        debug('action(s) found.');
        // tslint:disable-next-line:max-func-body-length
        yield cursor.eachAsync((doc) => __awaiter(this, void 0, void 0, function* () {
            sampleCount += 1;
            const action = doc.toObject();
            // 失敗ステータスのアクションを検出
            // const failedActions = actions.filter((a) => a.actionStatus === cinerino.factory.actionStatusType.FailedActionStatus);
            // debug('GMOServiceBadRequestError:', failedActions.filter((a) => a.error.name === 'GMOServiceBadRequestError').length);
            // ステータスごとのアクション数を集計
            switch (action.actionStatus) {
                case cinerino.factory.actionStatusType.ActiveActionStatus:
                    break;
                case cinerino.factory.actionStatusType.CanceledActionStatus:
                    numbersOfResult.canceled += 1;
                    break;
                case cinerino.factory.actionStatusType.CompletedActionStatus:
                    numbersOfResult.completed += 1;
                    break;
                // 失敗アクションについてエラー項目ごとにデータ整形
                case cinerino.factory.actionStatusType.FailedActionStatus:
                    numbersOfResult.failed += 1;
                    let summary;
                    // エラー名を集計
                    const errorName = action.error.name;
                    summary = errorNamesSummary.find((s) => s.key === errorName);
                    if (summary === undefined) {
                        errorNamesSummary.push({
                            key: errorName,
                            count: 1
                        });
                    }
                    else {
                        summary.count += 1;
                    }
                    // エラーメッセージを集計
                    const errorMessage = action.error.message;
                    summary = errorMessagesSummary.find((s) => s.key === errorMessage);
                    if (summary === undefined) {
                        errorMessagesSummary.push({
                            key: errorMessage,
                            count: 1
                        });
                    }
                    else {
                        summary.count += 1;
                    }
                    // GMOエラー内容を集計
                    const content = (Array.isArray(action.error.errors))
                        ? action.error.errors[0].content
                        : undefined;
                    if (content !== undefined) {
                        summary = contentSummary.find((s) => s.key === content);
                        if (summary === undefined) {
                            contentSummary.push({
                                key: content,
                                count: 1
                            });
                        }
                        else {
                            summary.count += 1;
                        }
                    }
                    // GMOエラー内容を集計
                    const userMessage = (Array.isArray(action.error.errors))
                        ? action.error.errors[0].userMessage
                        : undefined;
                    if (userMessage !== undefined) {
                        summary = userMessagesSummary.find((s) => s.key === userMessage);
                        if (summary === undefined) {
                            userMessagesSummary.push({
                                key: userMessage,
                                count: 1
                            });
                        }
                        else {
                            summary.count += 1;
                        }
                    }
                    break;
                default:
            }
            errorNamesSummary = errorNamesSummary.sort((a, b) => b.count - a.count);
            errorMessagesSummary = errorMessagesSummary.sort((a, b) => b.count - a.count);
            contentSummary = contentSummary.sort((a, b) => b.count - a.count);
            userMessagesSummary = userMessagesSummary.sort((a, b) => b.count - a.count);
            debug('----------------');
        }));
        const text = `## ${SUBJECT}
### Configurations
key  | value
------ | ------
databaseName  | ${mongoose.connection.db.databaseName}
集計対象期間  | ${aggregationStartFrom.toISOString()} - ${aggregationStartThrough.toISOString()}

### Summary
Action Status | ratio | number of results
------ | ------ | ------
completed | ${Math.floor(HUNDRED * numbersOfResult.completed / sampleCount)}% | ${numbersOfResult.completed}/${sampleCount}
failed | ${Math.floor(HUNDRED * numbersOfResult.failed / sampleCount)}% | ${numbersOfResult.failed}/${sampleCount}
canceled | ${Math.floor(HUNDRED * numbersOfResult.canceled / sampleCount)}% | ${numbersOfResult.canceled}/${sampleCount}

Error Name | ratio | number of results
------ | ------ | ------
${errorNamesSummary.map((s) => `${s.key} | ${Math.floor(HUNDRED * s.count / numbersOfResult.failed)}% | ${s.count}/${numbersOfResult.failed}`)
            .join('\n')}

Error Message | ratio | number of results
------ | ------ | ------
${errorMessagesSummary.map((s) => `${s.key} | ${Math.floor(HUNDRED * s.count / numbersOfResult.failed)}% | ${s.count}/${numbersOfResult.failed}`)
            .join('\n')}

GMO Error Content | ratio | number of results
------ | ------ | ------
${contentSummary.map((s) => `${s.key} | ${Math.floor(HUNDRED * s.count / numbersOfResult.failed)}% | ${s.count}/${numbersOfResult.failed}`)
            .join('\n')}

GMO User Message | ratio | number of results
------ | ------ | ------
${userMessagesSummary.map((s) => `${s.key} | ${Math.floor(HUNDRED * s.count / numbersOfResult.failed)}% | ${s.count}/${numbersOfResult.failed}`)
            .join('\n')}
        `;
        // tslint:disable-next-line:max-line-length
        // fs.writeFileSync(`${__dirname}/aggregation.md`, text);
        // return;
        // backlogへ通知
        const users = yield request.get({
            url: 'https://m-p.backlog.jp/api/v2/projects/CINERINO/users',
            json: true,
            qs: { apiKey: process.env.BACKLOG_API_KEY }
        })
            .then((body) => body);
        debug('notifying', users.length, 'people on backlog...');
        yield request.post({
            url: 'https://m-p.backlog.jp/api/v2/issues/CINERINO-571/comments',
            form: {
                content: text,
                notifiedUserId: users.map((user) => user.id)
            },
            qs: { apiKey: process.env.BACKLOG_API_KEY }
        })
            .promise();
        debug('posted to backlog.');
    });
}
exports.main = main;
mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default)
    .then(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield main();
        setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
            yield main();
        }), 
        // tslint:disable-next-line:no-magic-numbers
        300000);
        debug('success!');
    }
    catch (error) {
        // tslint:disable-next-line:no-console
        console.error(error);
    }
    // await mongoose.disconnect();
}))
    // tslint:disable-next-line:no-console
    .catch(console.error);
