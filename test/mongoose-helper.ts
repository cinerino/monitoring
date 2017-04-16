/**
 * mongooseヘルパー
 *
 * @ignore
 */
import * as mongoose from 'mongoose';
(<any>mongoose).Promise = global.Promise;

before(async () => {
    await mongoose.connect(process.env.MONGOLAB_URI);
});
