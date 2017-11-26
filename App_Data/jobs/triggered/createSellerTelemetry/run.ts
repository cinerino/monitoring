/**
 * 販売者向け測定データを作成する
 * @ignore
 */

import * as sskts from '@motionpicture/sskts-domain';
import * as createDebug from 'debug';
import * as moment from 'moment';

import mongooseConnectionOptions from '../../../../mongooseConnectionOptions';

const debug = createDebug('sskts-monitoring-jobs');

export async function main() {
    debug('connecting mongodb...');
    sskts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);

    const organizationRepo = new sskts.repository.Organization(sskts.mongoose.connection);
    const taskRepo = new sskts.repository.Task(sskts.mongoose.connection);
    const telemetryRepo = new sskts.repository.Telemetry(sskts.mongoose.connection);
    const transactionRepo = new sskts.repository.Transaction(sskts.mongoose.connection);
    const authorizeActionRepo = new sskts.repository.action.Authorize(sskts.mongoose.connection);
    debug('creating telemetry...');

    // 取引セッション時間に対して十分に時間を置いて計測する
    // tslint:disable-next-line:no-magic-numbers
    const dateNow = moment().add(-30, 'minutes');
    // tslint:disable-next-line:no-magic-numbers
    const measuredAt = moment.unix((dateNow.unix() - (dateNow.unix() % 60)));

    // 劇場組織ごとに販売者向け測定データを作成する
    const movieTheaters = await organizationRepo.searchMovieTheaters({});
    await Promise.all(movieTheaters.map(async (movieTheater) => {
        await sskts.service.report.createTelemetry({
            measuredAt: measuredAt.toDate(),
            sellerId: movieTheater.id
        })
            (taskRepo, telemetryRepo, transactionRepo, authorizeActionRepo);
    }));

    sskts.mongoose.disconnect();
}

main().then(() => {
    debug('success!');
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
