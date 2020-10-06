/**
 * 承認アクションについて分析する
 */
import * as cinerino from '@cinerino/domain';
import * as createDebug from 'debug';
// import * as fs from 'fs';
import * as moment from 'moment';
import * as mongoose from 'mongoose';
import * as request from 'request-promise-native';

import mongooseConnectionOptions from '../../../mongooseConnectionOptions';

const debug = createDebug('cinerino-monitoring');

const SUBJECT = 'Authorize action aggregation';
const BACKLOG_ISSUE_KEY = 'CINERINO-572';

// tslint:disable-next-line:max-func-body-length
export async function main() {
    const actionRepo = new cinerino.repository.Action(mongoose.connection);

    const targetObjectTypes = [
        cinerino.factory.chevre.offerType.Offer,
        cinerino.factory.action.authorize.paymentMethod.any.ResultType.Payment,
        cinerino.factory.action.authorize.offer.seatReservation.ObjectType.SeatReservation
    ];
    const startThrough = moment()
        .add(0, 'hours')
        .toDate();
    const startFrom = moment(startThrough)
        // tslint:disable-next-line:no-magic-numbers
        .add(-24, 'hours')
        .toDate();

    const results = await Promise.all(targetObjectTypes.map(async (objectType) => {
        let sampleCount: number = 0;
        let totalRequiredTime: number = 0;
        let maxRequiredTime: number = 0;
        let minRequiredTime: number = 0;
        let averageRequiredTime: number;

        const cursor = actionRepo.actionModel.find(
            {
                typeOf: cinerino.factory.actionType.AuthorizeAction,
                'object.typeOf': { $exists: true, $eq: objectType },
                actionStatus: cinerino.factory.actionStatusType.CompletedActionStatus,
                startDate: {
                    $gte: startFrom,
                    $lte: startThrough
                }
            },
            { startDate: 1, endDate: 1 }
        )
            .cursor();
        debug('actions found');

        await cursor.eachAsync(async (doc) => {
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
        });

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
    }));

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
    const users = await request.get(
        {
            url: 'https://m-p.backlog.jp/api/v2/projects/CINERINO/users',
            json: true,
            qs: { apiKey: process.env.BACKLOG_API_KEY }
        }
    )
        .then((body: any[]) => body);

    debug('notifying', users.length, 'people on backlog...');
    await request.post(
        {
            url: `https://m-p.backlog.jp/api/v2/issues/${BACKLOG_ISSUE_KEY}/comments`,
            form: {
                content: text,
                notifiedUserId: users.map((user) => user.id)
            },
            qs: { apiKey: process.env.BACKLOG_API_KEY }
        }
    )
        .promise();
    debug('posted to backlog.');
}

mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions)
    .then(async () => {
        try {
            await main();
            debug('success!');
        } catch (error) {
            // tslint:disable-next-line:no-console
            console.error(error);
        }

        await mongoose.disconnect();
    })
    // tslint:disable-next-line:no-console
    .catch(console.error);
