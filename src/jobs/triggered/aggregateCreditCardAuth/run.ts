/**
 * クレジットカードオーソリアクションデータを集計する
 */
import * as cinerino from '@cinerino/domain';
import * as createDebug from 'debug';
// import * as fs from 'fs';
import * as moment from 'moment';
import * as mongoose from 'mongoose';
import * as request from 'request-promise-native';

import mongooseConnectionOptions from '../../../mongooseConnectionOptions';

const debug = createDebug('cinerino-monitoring');

const SUBJECT = 'Credit Card Authorize Action Aggregation';
const HUNDRED = 100;
if (process.env.CREDIT_CARD_AUTH_AGGREGATION_PERIOD_IN_DAYS === undefined) {
    throw new Error('Environment variable \'CREDIT_CARD_AUTH_AGGREGATION_PERIOD_IN_DAYS\' required.');
}
const AGGREGATION_PERIOD_IN_DAYS = Number(process.env.CREDIT_CARD_AUTH_AGGREGATION_PERIOD_IN_DAYS);

interface ISummary {
    key: string;
    count: number;
}

// tslint:disable-next-line:max-func-body-length
export async function main() {
    const actionRepo = new cinerino.repository.Action(mongoose.connection);

    // 一定期間のクレジットカード承認アクションを検索
    const aggregationStartThrough = new Date();
    const aggregationStartFrom = moment(aggregationStartThrough)
        .add(-AGGREGATION_PERIOD_IN_DAYS, 'day')
        .toDate();

    let sampleCount: number = 0;
    const numbersOfResult: {
        completed: number;
        failed: number;
        canceled: number;
    } = {
        completed: 0,
        failed: 0,
        canceled: 0
    };
    let errorNamesSummary: ISummary[] = [];
    let errorMessagesSummary: ISummary[] = [];
    let contentSummary: ISummary[] = [];
    let userMessagesSummary: ISummary[] = [];

    debug('searching authorize actions...');
    const cursor = actionRepo.actionModel.find({
        startDate: {
            $gte: aggregationStartFrom,
            $lt: aggregationStartThrough
        },
        typeOf: cinerino.factory.actionType.AuthorizeAction,
        'object.typeOf': { $exists: true, $eq: cinerino.factory.paymentMethodType.CreditCard }
    })
        .cursor();
    debug('action(s) found.');

    // tslint:disable-next-line:max-func-body-length
    await cursor.eachAsync(async (doc) => {
        sampleCount += 1;
        const action = <cinerino.factory.action.authorize.paymentMethod.creditCard.IAction>doc.toObject();

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
                let summary: ISummary | undefined;

                // エラー名を集計
                const errorName = action.error.name;
                summary = errorNamesSummary.find((s) => s.key === errorName);
                if (summary === undefined) {
                    errorNamesSummary.push({
                        key: errorName,
                        count: 1
                    });
                } else {
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
                } else {
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
                    } else {
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
                    } else {
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
    });

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
${errorNamesSummary.map(
        (s) => `${s.key} | ${Math.floor(HUNDRED * s.count / numbersOfResult.failed)}% | ${s.count}/${numbersOfResult.failed}`
    )
            .join('\n')}

Error Message | ratio | number of results
------ | ------ | ------
${errorMessagesSummary.map(
                (s) => `${s.key} | ${Math.floor(HUNDRED * s.count / numbersOfResult.failed)}% | ${s.count}/${numbersOfResult.failed}`
            )
            .join('\n')}

GMO Error Content | ratio | number of results
------ | ------ | ------
${contentSummary.map(
                (s) => `${s.key} | ${Math.floor(HUNDRED * s.count / numbersOfResult.failed)}% | ${s.count}/${numbersOfResult.failed}`
            )
            .join('\n')}

GMO User Message | ratio | number of results
------ | ------ | ------
${userMessagesSummary.map(
                (s) => `${s.key} | ${Math.floor(HUNDRED * s.count / numbersOfResult.failed)}% | ${s.count}/${numbersOfResult.failed}`
            )
            .join('\n')}
        `;

    // tslint:disable-next-line:max-line-length
    // fs.writeFileSync(`${__dirname}/aggregation.md`, text);

    // return;

    // backlogへ通知
    const users = await request.get(
        {
            url: 'https://m-p.backlog.jp/api/v2/projects/SSKTS/users',
            json: true,
            qs: { apiKey: process.env.BACKLOG_API_KEY }
        }
    )
        .then((body: any[]) => body);

    debug('notifying', users.length, 'people on backlog...');
    await request.post(
        {
            url: 'https://m-p.backlog.jp/api/v2/issues/SSKTS-857/comments',
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

            setInterval(
                async () => {
                    await main();
                },
                // tslint:disable-next-line:no-magic-numbers
                300000
            );
            debug('success!');
        } catch (error) {
            // tslint:disable-next-line:no-console
            console.error(error);
        }

        // await mongoose.disconnect();
    })
    // tslint:disable-next-line:no-console
    .catch(console.error);
