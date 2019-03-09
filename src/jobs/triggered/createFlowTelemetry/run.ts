/**
 * 販売者向け測定データを作成する
 */
import * as cinerino from '@cinerino/domain';
import * as createDebug from 'debug';
import * as moment from 'moment';
import * as mongoose from 'mongoose';

import mongooseConnectionOptions from '../../../mongooseConnectionOptions';

const debug = createDebug('cinerino-monitoring');

export async function main() {
    debug('connecting mongodb...');
    await mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);

    const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
    const taskRepo = new cinerino.repository.Task(mongoose.connection);
    const telemetryRepo = new cinerino.repository.Telemetry(mongoose.connection);
    const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
    const actionRepo = new cinerino.repository.Action(mongoose.connection);
    debug('creating telemetry...');

    // 取引セッション時間に対して十分に時間を置いて計測する
    const dateNow = moment()
        // tslint:disable-next-line:no-magic-numbers
        .add(-30, 'minutes');
    // tslint:disable-next-line:no-magic-numbers
    const measuredAt = moment.unix((dateNow.unix() - (dateNow.unix() % 60)));

    // 劇場組織ごとに販売者向け測定データを作成する
    const movieTheaters = await sellerRepo.search({});
    await Promise.all(movieTheaters.map(async (movieTheater) => {
        await cinerino.service.report.telemetry.createFlow({
            measuredAt: measuredAt.toDate(),
            sellerId: movieTheater.id
        })({
            task: taskRepo,
            telemetry: telemetryRepo,
            transaction: transactionRepo,
            action: actionRepo
        });
    }));

    await cinerino.service.report.telemetry.createFlow({
        measuredAt: measuredAt.toDate()
    })({
        task: taskRepo,
        telemetry: telemetryRepo,
        transaction: transactionRepo,
        action: actionRepo
    });

    debug('diconnecting mongo...');
    await mongoose.disconnect();
}

main()
    .then(() => {
        debug('success!');
    })
    .catch((err) => {
        // tslint:disable-next-line:no-console
        console.error(err);
        process.exit(1);
    });
