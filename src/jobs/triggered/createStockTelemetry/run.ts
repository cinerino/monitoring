/**
 * グローバル測定データを作成する
 */
import * as sskts from '@motionpicture/sskts-domain';
import * as createDebug from 'debug';
import * as moment from 'moment';
import * as mongoose from 'mongoose';

import mongooseConnectionOptions from '../../../mongooseConnectionOptions';

const debug = createDebug('sskts-monitoring-jobs');

export async function main() {
    debug('connecting mongodb...');
    await mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);

    const sellerRepo = new sskts.repository.Seller(mongoose.connection);
    const taskRepo = new sskts.repository.Task(mongoose.connection);
    const telemetryRepo = new sskts.repository.Telemetry(mongoose.connection);
    const transactionRepo = new sskts.repository.Transaction(mongoose.connection);
    const actionRepo = new sskts.repository.Action(mongoose.connection);
    debug('creating telemetry...');

    const dateNow = moment();
    // tslint:disable-next-line:no-magic-numbers
    const measuredAt = moment.unix((dateNow.unix() - (dateNow.unix() % 60)));

    // 劇場組織ごとに販売者向け測定データを作成する
    const movieTheaters = await sellerRepo.search({});
    await Promise.all(movieTheaters.map(async (movieTheater) => {
        await sskts.service.report.telemetry.createStock({
            measuredAt: measuredAt.toDate(),
            sellerId: movieTheater.id
        })({
            task: taskRepo,
            telemetry: telemetryRepo,
            transaction: transactionRepo,
            action: actionRepo
        });
    }));

    await sskts.service.report.telemetry.createStock({
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
