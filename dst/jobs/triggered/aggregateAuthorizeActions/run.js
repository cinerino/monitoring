"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 承認アクションについて分析する
 */
const sskts = require("@motionpicture/sskts-domain");
const createDebug = require("debug");
// import * as fs from 'fs';
const moment = require("moment");
const mongoose = require("mongoose");
const request = require("request-promise-native");
const mongooseConnectionOptions_1 = require("../../../mongooseConnectionOptions");
const debug = createDebug('sskts-monitoring-jobs');
const SUBJECT = '承認アクション集計';
const BACKLOG_ISSUE_KEY = 'SSKTS-1179';
// tslint:disable-next-line:max-func-body-length
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const actionRepo = new sskts.repository.Action(mongoose.connection);
        const targetObjectTypes = [
            ...Object.values(sskts.factory.paymentMethodType),
            sskts.factory.action.authorize.offer.seatReservation.ObjectType.SeatReservation
        ];
        const startThrough = moment()
            .add(0, 'hours')
            .toDate();
        const startFrom = moment(startThrough)
            // tslint:disable-next-line:no-magic-numbers
            .add(-24, 'hours')
            .toDate();
        const results = yield Promise.all(targetObjectTypes.map((objectType) => __awaiter(this, void 0, void 0, function* () {
            const actions = yield actionRepo.actionModel.find({
                typeOf: sskts.factory.actionType.AuthorizeAction,
                'object.typeOf': objectType,
                actionStatus: sskts.factory.actionStatusType.CompletedActionStatus,
                startDate: {
                    $gte: startFrom,
                    $lte: startThrough
                }
            }, { startDate: 1, endDate: 1 })
                .exec()
                .then((docs) => docs.map((doc) => doc.toObject()));
            debug(objectType, actions.length, 'actions found');
            const requiredTimes = actions.map((a) => moment(a.endDate)
                .diff(moment(a.startDate, 'milliseconds')));
            const timesCount = requiredTimes.length;
            const maxRequiredTime = requiredTimes.reduce((a, b) => Math.max(a, b), 0);
            const minRequiredTime = requiredTimes.reduce((a, b) => Math.min(a, b), (timesCount > 0) ? requiredTimes[0] : 0);
            const totalRequiredTime = requiredTimes.reduce((a, b) => a + b, 0);
            const averageRequiredTime = (requiredTimes.length > 0) ? Math.floor(totalRequiredTime / timesCount) : 0;
            debug(objectType, 'max:', maxRequiredTime);
            debug(objectType, 'min:', minRequiredTime);
            debug(objectType, 'average:', averageRequiredTime);
            debug('----------------');
            return {
                objectType: objectType,
                count: timesCount,
                total: totalRequiredTime,
                max: maxRequiredTime,
                min: minRequiredTime,
                average: averageRequiredTime
            };
        })));
        const text = `## ${SUBJECT}
### Configurations
key  | value
------ | ------
databaseName  | ${mongoose.connection.db.databaseName}
集計対象期間  | ${startFrom.toISOString()} - ${startThrough.toISOString()}

### 所要時間(ms)
承認対象 | 承認数 | 合計所要時間 | 最大所要時間 | 最小所要時間 | 平均所要時間
------ | ------ | ------ | ------ | ------ | ------
${results.map((r) => `${r.objectType} | ${r.count} | ${r.total} | ${r.max} | ${r.min} | ${r.average}`)
            .join('\n')}
        `;
        // tslint:disable-next-line:max-line-length
        // fs.writeFileSync(`${__dirname}/aggregation.md`, text);
        // return;
        // backlogへ通知
        const users = yield request.get({
            url: 'https://m-p.backlog.jp/api/v2/projects/SSKTS/users',
            json: true,
            qs: { apiKey: process.env.BACKLOG_API_KEY }
        })
            .then((body) => body);
        debug('notifying', users.length, 'people on backlog...');
        yield request.post({
            url: `https://m-p.backlog.jp/api/v2/issues/${BACKLOG_ISSUE_KEY}/comments`,
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
    .then(() => __awaiter(this, void 0, void 0, function* () {
    try {
        yield main();
        debug('success!');
    }
    catch (error) {
        // tslint:disable-next-line:no-console
        console.error(error);
    }
    yield mongoose.disconnect();
}))
    // tslint:disable-next-line:no-console
    .catch(console.error);
