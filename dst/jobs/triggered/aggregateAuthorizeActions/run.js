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
 * 承認アクションについて分析する
 */
const cinerino = require("@cinerino/domain");
const createDebug = require("debug");
// import * as fs from 'fs';
const moment = require("moment");
const mongoose = require("mongoose");
const request = require("request-promise-native");
const mongooseConnectionOptions_1 = require("../../../mongooseConnectionOptions");
const debug = createDebug('cinerino-monitoring');
const SUBJECT = 'Authorize action aggregation';
const BACKLOG_ISSUE_KEY = 'SSKTS-1179';
// tslint:disable-next-line:max-func-body-length
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const targetObjectTypes = [
            ...Object.values(cinerino.factory.paymentMethodType),
            cinerino.factory.action.authorize.offer.seatReservation.ObjectType.SeatReservation
        ];
        const startThrough = moment()
            .add(0, 'hours')
            .toDate();
        const startFrom = moment(startThrough)
            // tslint:disable-next-line:no-magic-numbers
            .add(-24, 'hours')
            .toDate();
        const results = yield Promise.all(targetObjectTypes.map((objectType) => __awaiter(this, void 0, void 0, function* () {
            let sampleCount = 0;
            let totalRequiredTime = 0;
            let maxRequiredTime = 0;
            let minRequiredTime = 0;
            let averageRequiredTime;
            const cursor = actionRepo.actionModel.find({
                typeOf: cinerino.factory.actionType.AuthorizeAction,
                'object.typeOf': { $exists: true, $eq: objectType },
                actionStatus: cinerino.factory.actionStatusType.CompletedActionStatus,
                startDate: {
                    $gte: startFrom,
                    $lte: startThrough
                }
            }, { startDate: 1, endDate: 1 })
                .cursor();
            debug('actions found');
            yield cursor.eachAsync((doc) => __awaiter(this, void 0, void 0, function* () {
                sampleCount += 1;
                const action = doc.toObject();
                const requiredTime = moment(action.endDate)
                    .diff(moment(action.startDate, 'milliseconds'));
                totalRequiredTime += requiredTime;
                maxRequiredTime = Math.max(maxRequiredTime, requiredTime);
                minRequiredTime = (sampleCount === 1) ? requiredTime : Math.min(minRequiredTime, requiredTime);
                debug(objectType, 'max:', maxRequiredTime);
                debug(objectType, 'min:', minRequiredTime);
                debug('----------------');
            }));
            debug('----------------');
            averageRequiredTime = (sampleCount > 0) ? Math.floor(totalRequiredTime / sampleCount) : 0;
            return {
                objectType: objectType,
                count: sampleCount,
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
Aggregation period  | ${startFrom.toISOString()} - ${startThrough.toISOString()}

### Processing time(ms)
Object Type | Sample Count | Sum | Max | Min | Avg
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
    .then(() => __awaiter(void 0, void 0, void 0, function* () {
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
