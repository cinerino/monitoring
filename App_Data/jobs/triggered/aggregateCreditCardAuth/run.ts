/**
 * クレジットカードオーソリアクションデータを集計する
 * @ignore
 */

import * as sskts from '@motionpicture/sskts-domain';
import * as createDebug from 'debug';
// import * as fs from 'fs';
import * as moment from 'moment';
import * as request from 'request-promise-native';

import mongooseConnectionOptions from '../../../../mongooseConnectionOptions';

const debug = createDebug('sskts-monitoring-jobs');

// tslint:disable-next-line:max-func-body-length
export async function main() {
    const actionRepo = new sskts.repository.Action(sskts.mongoose.connection);

    const aggregationStartThrough = new Date();
    // tslint:disable-next-line:no-magic-numbers
    const aggregationStartFrom = moment(aggregationStartThrough).add(-3, 'day').toDate();
    const actions = await actionRepo.actionModel.find({
        startDate: {
            $gte: aggregationStartFrom,
            $lt: aggregationStartThrough
        },
        typeOf: sskts.factory.actionType.AuthorizeAction,
        'object.typeOf': sskts.factory.action.authorize.creditCard.ObjectType.CreditCard,
        'purpose.id': { $exists: true }
    }).then((docs) => docs.map((doc) => <sskts.factory.action.authorize.creditCard.IAction>doc.toObject()));
    debug(actions.length, 'action(s) found.');

    const failedActions = actions.filter((a) => a.actionStatus === sskts.factory.actionStatusType.FailedActionStatus);
    debug('GMOServiceBadRequestError:', failedActions.filter((a) => a.error.name === 'GMOServiceBadRequestError').length);

    const errorNames = [...new Set(failedActions.map((a) => a.error.name))];
    const errorMessages = [...new Set(failedActions.map((a) => a.error.message))];
    const contents = [...new Set(
        failedActions.filter((a) => Array.isArray(a.error.errors)).map((a) => a.error.errors[0].content)
    )];
    const userMessages = [...new Set(
        failedActions.filter((a) => Array.isArray(a.error.errors)).map((a) => a.error.errors[0].userMessage)
    )];

    const subject = 'Aggregation of credit card authorize action';
    const HUNDRED = 100;

    const numbersOfResult = {
        completed: actions.filter((a) => a.actionStatus === sskts.factory.actionStatusType.CompletedActionStatus).length,
        failed: actions.filter((a) => a.actionStatus === sskts.factory.actionStatusType.FailedActionStatus).length,
        canceled: actions.filter((a) => a.actionStatus === sskts.factory.actionStatusType.CanceledActionStatus).length
    };

    const errorNamesSummary = errorNames.map((errorName) => {
        const count = failedActions.filter((a) => a.error.name === errorName).length;

        return {
            key: errorName,
            ratio: Math.floor(HUNDRED * count / failedActions.length),
            count: count,
            total: failedActions.length
        };
    }).sort((a, b) => b.ratio - a.ratio);

    const errorMessagesSummary = errorMessages.map((errorMessage) => {
        const count = failedActions.filter((a) => a.error.message === errorMessage).length;

        return {
            key: errorMessage,
            ratio: Math.floor(HUNDRED * count / failedActions.length),
            count: count,
            total: failedActions.length
        };
    }).sort((a, b) => b.ratio - a.ratio);

    const contentSummary = contents.map((content) => {
        const count = failedActions.filter((a) => Array.isArray(a.error.errors) && a.error.errors[0].content === content).length;

        return {
            key: content,
            ratio: Math.floor(HUNDRED * count / failedActions.length),
            count: count,
            total: failedActions.length
        };
    }).sort((a, b) => b.ratio - a.ratio);

    const userMessagesSummary = userMessages.map((userMessage) => {
        const count = failedActions.filter((a) => Array.isArray(a.error.errors) && a.error.errors[0].userMessage === userMessage).length;

        return {
            key: userMessage,
            ratio: Math.floor(HUNDRED * count / failedActions.length),
            count: count,
            total: failedActions.length
        };
    }).sort((a, b) => b.ratio - a.ratio);

    const text = `## ${subject}
### Configurations
key  | value
------ | ------
databaseName  | ${sskts.mongoose.connection.db.databaseName}
集計対象期間  | ${aggregationStartFrom.toISOString()} - ${aggregationStartThrough.toISOString()}

### Summary
アクションステータス | ratio | number of results
------ | ------ | ------
completed | ${Math.floor(HUNDRED * numbersOfResult.completed / actions.length)}% | ${numbersOfResult.completed}/${actions.length}
failed | ${Math.floor(HUNDRED * numbersOfResult.failed / actions.length)}% | ${numbersOfResult.failed}/${actions.length}
canceled | ${Math.floor(HUNDRED * numbersOfResult.canceled / actions.length)}% | ${numbersOfResult.canceled}/${actions.length}

アクションエラーネーム | ratio | number of results
------ | ------ | ------
${errorNamesSummary.map((s) => `${s.key} | ${s.ratio}% | ${s.count}/${s.total}`).join('\n')}

アクションエラーメッセージ | ratio | number of results
------ | ------ | ------
${errorMessagesSummary.map((s) => `${s.key} | ${s.ratio}% | ${s.count}/${s.total}`).join('\n')}

GMOエラー内容 | ratio | number of results
------ | ------ | ------
${contentSummary.map((s) => `${s.key} | ${s.ratio}% | ${s.count}/${s.total}`).join('\n')}

GMOユーザーメッセージ | ratio | number of results
------ | ------ | ------
${userMessagesSummary.map((s) => `${s.key} | ${s.ratio}% | ${s.count}/${s.total}`).join('\n')}
        `;

    // tslint:disable-next-line:max-line-length
    // fs.writeFileSync(`${__dirname}/aggregation.md`, text);

    // return;

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
            url: `https://m-p.backlog.jp/api/v2/issues/SSKTS-857/comments?apiKey=${process.env.BACKLOG_API_KEY}`,
            form: {
                content: text,
                notifiedUserId: users.map((user) => user.id)
            }
        }
    );

    debug('posted to backlog.');
}

sskts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions)
    .then(async () => {
        try {
            await main();
            debug('success!');
        } catch (error) {
            console.error(error);
        }

        await sskts.mongoose.disconnect();
    })
    .catch(console.error);
