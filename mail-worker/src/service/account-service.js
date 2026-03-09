import BizError from '../error/biz-error';
import verifyUtils from '../utils/verify-utils';
import emailUtils from '../utils/email-utils';
import userService from './user-service';
import emailService from './email-service';
import orm from '../entity/orm';
import account from '../entity/account';
import user from '../entity/user';
import email from '../entity/email';
import { and, asc, eq, gt, inArray, count, sql, ne, or, lt, desc } from 'drizzle-orm';
import {accountConst, isDel, settingConst} from '../const/entity-const';
import settingService from './setting-service';
import turnstileService from './turnstile-service';
import roleService from './role-service';
import { t } from '../i18n/i18n';
import verifyRecordService from './verify-record-service';

const accountService = {

	async add(c, params, userId) {

		const { addEmailVerify , addEmail, manyEmail, addVerifyCount, minEmailPrefix, emailPrefixFilter } = await settingService.query(c);

		let { email, token } = params;


		if (!(addEmail === settingConst.addEmail.OPEN && manyEmail === settingConst.manyEmail.OPEN)) {
			throw new BizError(t('addAccountDisabled'));
		}


		if (!email) {
			throw new BizError(t('emptyEmail'));
		}

		if (!verifyUtils.isEmail(email)) {
			throw new BizError(t('notEmail'));
		}

		if (!c.env.domain.includes(emailUtils.getDomain(email))) {
			throw new BizError(t('notExistDomain'));
		}

		if (emailUtils.getName(email).length < minEmailPrefix) {
			throw new BizError(t('minEmailPrefix', { msg: minEmailPrefix } ));
		}

		if (emailPrefixFilter.some(content => emailUtils.getName(email).includes(content))) {
			throw new BizError(t('banEmailPrefix'));
		}

		let accountRow = await this.selectByEmailIncludeDel(c, email);

		if (accountRow && accountRow.isDel === isDel.DELETE) {
			throw new BizError(t('isDelAccount'));
		}

		if (accountRow) {
			throw new BizError(t('isRegAccount'));
		}

		const userRow = await userService.selectById(c, userId);
		const roleRow = await roleService.selectById(c, userRow.type);

		if (userRow.email !== c.env.admin) {

			if (roleRow.accountCount > 0) {
				const userAccountCount = await accountService.countUserAccount(c, userId)
				if(userAccountCount >= roleRow.accountCount) throw new BizError(t('accountLimit'), 403);
			}

			if(!roleService.hasAvailDomainPerm(roleRow.availDomain, email)) {
				throw new BizError(t('noDomainPermAdd'),403)
			}

		}

		let addVerifyOpen = false

		if (addEmailVerify === settingConst.addEmailVerify.OPEN) {
			addVerifyOpen = true
			await turnstileService.verify(c, token);
		}

		if (addEmailVerify === settingConst.addEmailVerify.COUNT) {
			addVerifyOpen = await verifyRecordService.isOpenAddVerify(c, addVerifyCount);
			if (addVerifyOpen) {
				await turnstileService.verify(c,token)
			}
		}


		accountRow = await orm(c).insert(account).values({ email: email, userId: userId, name: emailUtils.getName(email) }).returning().get();

		if (addEmailVerify === settingConst.addEmailVerify.COUNT && !addVerifyOpen) {
			const row = await verifyRecordService.increaseAddCount(c);
			addVerifyOpen = row.count >= addVerifyCount
		}

		accountRow.addVerifyOpen = addVerifyOpen
		return accountRow;
	},

	selectByEmailIncludeDel(c, email) {
		return orm(c).select().from(account).where(sql`${account.email} COLLATE NOCASE = ${email}`).get();
	},

	list(c, params, userId) {

		let { accountId, size, lastSort, email } = params;

		accountId = Number(accountId);
		size = Number(size);
		lastSort = Number(lastSort);

		if (size > 30) {
			size = 30;
		}

		if (!accountId) {
			accountId = 0;
		}

		if(Number.isNaN(lastSort)) {
			lastSort = 9999999999;
		}

		const conditions = [
			eq(account.userId, userId),
			eq(account.isDel, isDel.NORMAL),
			or(
				lt(account.sort, lastSort),
				and(
					eq(account.sort, lastSort),
					gt(account.accountId, accountId)
				)
			)
		];

		if (email) {
			conditions.push(sql`${account.email} COLLATE NOCASE LIKE ${'%' + email + '%'}`);
		}

		return orm(c).select().from(account).where(and(...conditions))
			.orderBy(desc(account.sort), asc(account.accountId))
			.limit(size)
			.all();
	},

	async delete(c, params, userId) {

		let { accountId, email } = params;
		accountId = Number(accountId);

		const user = await userService.selectById(c, userId);
		let accountRow = null;

		if (email) {
			accountRow = await this.selectByEmailIncludeDel(c, email);
		} else if (accountId) {
			accountRow = await this.selectById(c, accountId);
		}

		if (!accountRow || accountRow.isDel === isDel.DELETE) {
			throw new BizError(t('noUserAccount'));
		}

		if (accountRow.email === user.email) {
			throw new BizError(t('delMyAccount'));
		}

		if (accountRow.userId !== user.userId) {
			throw new BizError(t('noUserAccount'));
		}

		await orm(c).update(account).set({ isDel: isDel.DELETE }).where(
			and(eq(account.userId, userId),
				eq(account.accountId, accountRow.accountId)))
			.run();
	},

	selectById(c, accountId) {
		return orm(c).select().from(account).where(
			and(eq(account.accountId, accountId),
				eq(account.isDel, isDel.NORMAL)))
			.get();
	},

	async insert(c, params) {
		await orm(c).insert(account).values({ ...params }).returning();
	},

	async insertList(c, list) {
		await orm(c).insert(account).values(list).run();
	},

	async physicsDeleteByUserIds(c, userIds) {
		await emailService.physicsDeleteUserIds(c, userIds);
		await orm(c).delete(account).where(inArray(account.userId,userIds)).run();
	},

	async deleteByUserId(c, userId) {
		await orm(c).update(account).set({ isDel: isDel.DELETE }).where(eq(account.userId, userId)).run();
	},

	async selectUserAccountCountList(c, userIds, del = isDel.NORMAL) {
		const result = await orm(c)
			.select({
				userId: account.userId,
				count: count(account.accountId)
			})
			.from(account)
			.where(and(
				inArray(account.userId, userIds),
				eq(account.isDel, del)
			))
			.groupBy(account.userId)
		return result;
	},

	async countUserAccount(c, userId) {
		const { num } = await orm(c).select({num: count()}).from(account).where(and(eq(account.userId, userId),eq(account.isDel, isDel.NORMAL))).get();
		return num;
	},

	async restoreByEmail(c, email) {
		await orm(c).update(account).set({isDel: isDel.NORMAL}).where(eq(account.email, email)).run();
	},

	async restoreByUserId(c, userId) {
		await orm(c).update(account).set({isDel: isDel.NORMAL}).where(eq(account.userId, userId)).run();
	},

	async setName(c, params, userId) {
		const { name, accountId } = params
		if (name.length > 30) {
			throw new BizError(t('usernameLengthLimit'));
		}
		await orm(c).update(account).set({name}).where(and(eq(account.userId, userId),eq(account.accountId, accountId))).run();
	},

	async listAll(c, params) {

		let { num, size, email, userEmail, isDel: isDelFilter, sortBy, sortOrder } = params

		num = Number(num)
		size = Number(size)
		isDelFilter = Number(isDelFilter)

		if (size > 50) {
			size = 50;
		}

		if (!size || size < 1) {
			size = 15;
		}

		if (!num || num < 1) {
			num = 1;
		}

		num = (num - 1) * size;

		const conditions = [];

		if (!Number.isNaN(isDelFilter) && (isDelFilter === isDel.NORMAL || isDelFilter === isDel.DELETE)) {
			conditions.push(eq(account.isDel, isDelFilter));
		}

		if (email) {
			conditions.push(sql`${account.email} COLLATE NOCASE LIKE ${email + '%'}`);
		}

		if (userEmail) {
			conditions.push(sql`${user.email} COLLATE NOCASE LIKE ${userEmail + '%'}`);
		}

		const query = orm(c).select({ ...account, userEmail: user.email })
			.from(account)
			.leftJoin(user, eq(account.userId, user.userId));

		const totalQuery = orm(c).select({ total: count() })
			.from(account)
			.leftJoin(user, eq(account.userId, user.userId));

		if (conditions.length > 0) {
			query.where(and(...conditions));
			totalQuery.where(and(...conditions));
		}

		if (sortBy === 'name') {
			if (sortOrder === 'desc') {
				query.orderBy(desc(account.name), desc(account.accountId));
			} else {
				query.orderBy(asc(account.name), asc(account.accountId));
			}
		} else {
			if (sortOrder === 'asc') {
				query.orderBy(asc(account.createTime), asc(account.accountId));
			} else {
				query.orderBy(desc(account.createTime), desc(account.accountId));
			}
		}

		const list = await query.limit(size).offset(num).all();
		const { total } = await totalQuery.get();

		return { list, total }
	},
		async allAccount(c, params) {

		let { userId, num, size, email, isDel: isDelFilter, sortBy, sortOrder } = params

		userId = Number(userId)
		num = Number(num)
		size = Number(size)
		isDelFilter = Number(isDelFilter)

		if (size > 30) {
			size = 30;
		}

		if (!size || size < 1) {
			size = 10;
		}

		if (!num || num < 1) {
			num = 1;
		}

		num = (num - 1) * size;

		const userRow = await userService.selectByIdIncludeDel(c, userId);

		const conditions = [
			eq(account.userId, userId),
			ne(account.email, userRow.email)
		];

		if (!Number.isNaN(isDelFilter) && (isDelFilter === isDel.NORMAL || isDelFilter === isDel.DELETE)) {
			conditions.push(eq(account.isDel, isDelFilter));
		}

		if (email) {
			conditions.push(sql`${account.email} COLLATE NOCASE LIKE ${email + '%'} `);
		}

		const query = orm(c).select().from(account).where(and(...conditions));

		if (sortBy === 'name') {
			if (sortOrder === 'desc') {
				query.orderBy(desc(account.name), desc(account.accountId));
			} else {
				query.orderBy(asc(account.name), asc(account.accountId));
			}
		} else {
			if (sortOrder === 'asc') {
				query.orderBy(asc(account.createTime), asc(account.accountId));
			} else {
				query.orderBy(desc(account.createTime), desc(account.accountId));
			}
		}

		const list = await query.limit(size).offset(num).all();
		const { total } = await orm(c).select({ total: count() }).from(account).where(and(...conditions)).get();

		return { list, total }
	},

	async physicsDelete(c, params) {
		const { accountId } = params
		await emailService.physicsDeleteByAccountId(c, accountId)
		await orm(c).delete(account).where(eq(account.accountId, accountId)).run();
	},

	async markGptBan(c, params) {

		const remove = String(params.remove) === '1' || String(params.remove) === 'true';
		const keyword = 'OpenAI - Access Deactivated';

		const rows = await orm(c)
			.select({ accountId: account.accountId })
			.from(account)
			.where(and(
				eq(account.isDel, isDel.NORMAL),
				sql`EXISTS (SELECT 1 FROM email e WHERE e.account_id = ${account.accountId} AND e.subject COLLATE NOCASE LIKE ${'%' + keyword + '%'})`
			))
			.all();

		const accountIds = [...new Set(rows.map(item => item.accountId))];

		if (accountIds.length === 0) {
			return { total: 0, marked: 0, deleted: 0, accountIds: [] };
		}

		await orm(c).update(account).set({ status: accountConst.status.GPT_BAN }).where(inArray(account.accountId, accountIds)).run();

		let deleted = 0;
		if (remove) {
			await orm(c).update(account).set({ isDel: isDel.DELETE }).where(inArray(account.accountId, accountIds)).run();
			deleted = accountIds.length;
		}

		return { total: accountIds.length, marked: accountIds.length, deleted, accountIds };
	},

	async batchDelete(c, params, userId) {
		let { accountIds } = params;

		if (!accountIds) {
			return;
		}

		accountIds = [...new Set(accountIds.split(',').map(item => Number(item)).filter(Boolean))];

		if (accountIds.length === 0) {
			return;
		}

		const userRow = await userService.selectById(c, userId);
		const accountRows = await orm(c).select().from(account).where(and(
			eq(account.userId, userId),
			inArray(account.accountId, accountIds),
			eq(account.isDel, isDel.NORMAL)
		)).all();

		if (accountRows.length !== accountIds.length) {
			throw new BizError(t('noUserAccount'));
		}

		if (accountRows.some(row => row.email === userRow.email)) {
			throw new BizError(t('delMyAccount'));
		}

		await orm(c).update(account).set({ isDel: isDel.DELETE }).where(and(
			eq(account.userId, userId),
			inArray(account.accountId, accountIds)
		)).run();
	},

	async setAllReceive(c, params, userId) {
		let a = null
		const { accountId } = params;
		const accountRow = await this.selectById(c, accountId);
		if (accountRow.userId !== userId) {
			return;
		}
		await orm(c).update(account).set({ allReceive: accountConst.allReceive.CLOSE }).where(eq(account.userId, userId)).run();
		await orm(c).update(account).set({ allReceive: accountRow.allReceive ? 0 : 1 }).where(eq(account.accountId, accountId)).run();
	},

	async setAsTop(c, params, userId) {
		const { accountId } = params;
		console.log(accountId);
		const userRow = await userService.selectById(c, userId);
		const mainAccountRow = await accountService.selectByEmailIncludeDel(c, userRow.email);
		let mainSort = mainAccountRow.sort === 0 ? 2 : mainAccountRow.sort + 1;
		await orm(c).update(account).set({ sort: mainSort }).where(eq(account.email, userRow.email )).run();
		await orm(c).update(account).set({ sort: mainSort - 1 }).where(and(eq(account.accountId, accountId),eq(account.userId,userId))).run();
	}
};

export default accountService;




