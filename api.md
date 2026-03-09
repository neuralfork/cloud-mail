# Cloud Mail API 文档

## 1. 基础信息

- 本地地址: `http://localhost:8787`
- 统一前缀: 所有后端接口对外通过 `/api` 暴露
- 完整示例: `GET http://localhost:8787/api/account/list`
- 鉴权头: `Authorization: <JWT_TOKEN>`
- 公共 Token 头: `Authorization: <PUBLIC_TOKEN>` (仅 `/api/public/*`)

### 统一返回结构

```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

## 2. 鉴权与权限

### 2.1 无需 JWT 的接口

- `/api/login`
- `/api/register`
- `/api/oss/*`
- `/api/setting/websiteConfig`
- `/api/webhooks`
- `/api/init/:secret`
- `/api/public/genToken`
- `/api/telegram/*`
- `/api/test/*`
- `/api/oauth/*`

### 2.2 需要 JWT + 权限校验（管理员可跳过细粒度权限）

- `/api/email/send`, `/api/email/delete`
- `/api/account/list`, `/api/account/adminList`, `/api/account/markGptBan`, `/api/account/delete`, `/api/account/batchDelete`, `/api/account/add`
- `/api/my/delete`
- `/api/analysis/echarts`
- `/api/role/add`, `/api/role/list`, `/api/role/delete`, `/api/role/set`, `/api/role/setDefault`
- `/api/allEmail/list`, `/api/allEmail/delete`, `/api/allEmail/batchDelete`, `/api/allEmail/latest`
- `/api/setting/set`, `/api/setting/query`, `/api/setting/setBackground`, `/api/setting/deleteBackground`
- `/api/user/delete`, `/api/user/deleteByEmail`, `/api/user/setPwd`, `/api/user/setStatus`, `/api/user/setType`, `/api/user/list`, `/api/user/listAll`, `/api/user/resetSendCount`, `/api/user/add`, `/api/user/deleteAccount`, `/api/user/allAccount`
- `/api/regKey/add`, `/api/regKey/list`, `/api/regKey/delete`, `/api/regKey/clearNotUse`, `/api/regKey/history`

## 3. 接口明细

## 3.1 登录与注册

### `POST /api/login`
- Body: `email`, `password`
- 返回: `{ token }`

### `POST /api/register`
- Body: `email`, `password`, `token?`, `code?`
- 说明: `token` 为 Turnstile 验证令牌（开启验证时需要）；`code` 为注册码（开启注册码时需要）

### `DELETE /api/logout`
- 需 JWT

## 3.2 当前用户

### `GET /api/my/loginUserInfo`
- 需 JWT

### `PUT /api/my/resetPassword`
- 需 JWT
- Body: `password`

### `DELETE /api/my/delete`
- 需 JWT + `my:delete`

## 3.3 用户管理（User）

### `GET /api/user/list`
- Query: `num`, `size`, `email?`, `timeSort?`, `status?`, `isDel?`

### `GET /api/user/listAll`
- Query: `num`, `size`, `email?`, `timeSort?`, `status?`

### `POST /api/user/add`
- Body: `email`, `password`, `type`

### `PUT /api/user/setPwd`
- Body: `userId`, `password`

### `PUT /api/user/setStatus`
- Body: `userId`, `status`

### `PUT /api/user/setType`
- Body: `userId`, `type`

### `PUT /api/user/resetSendCount`
- Body: `userId`

### `PUT /api/user/restore`
- Body: `userId`, `type?`

### `DELETE /api/user/delete`
- Query: `userIds` (逗号分隔)

### `DELETE /api/user/deleteByEmail`
- Query: `emails` (逗号分隔) 或 `email`

### `GET /api/user/allAccount`
- Query: `userId`, `num?`, `size?`, `email?`, `isDel?`, `sortBy?`, `sortOrder?`

### `DELETE /api/user/deleteAccount`
- Query: `accountId`

## 3.4 邮箱账户管理（Account）

### `GET /api/account/list`
- Query: `accountId?`, `size?`, `lastSort?`, `email?`

### `GET /api/account/adminList`
- Query: `num?`, `size?`, `email?`, `userEmail?`, `isDel?`, `sortBy?`, `sortOrder?`
- 说明:
- `isDel`: `0` 正常, `1` 已删除
- `sortBy`: `createTime`(默认) 或 `name`
- `sortOrder`: `asc` / `desc`

### `POST /api/account/add`
- Body: `email`, `token?`

### `PUT /api/account/setName`
- Body: `accountId`, `name`

### `PUT /api/account/setAllReceive`
- Body: `accountId`

### `PUT /api/account/setAsTop`
- Body: `accountId`

### `PUT /api/account/markGptBan`
- Body: `remove` (`true/false` 或 `1/0`)
- 行为: 检测标题含 `OpenAI - Access Deactivated` 的邮件，命中后将账户状态标记为 `gpt_ban`；`remove=true` 时同时逻辑删除账户
- 返回: `{ total, marked, deleted, accountIds }`

### `DELETE /api/account/delete`
- Query: `accountId` 或 `email`

### `DELETE /api/account/batchDelete`
- Query: `accountIds` (逗号分隔)

## 3.5 当前用户邮件（Email）

### `GET /api/email/list`
- Query: `accountId`, `allReceive?`, `emailId?`, `timeSort?`, `size?`, `type`
- 说明:
- `type`: `0` 收件 / `1` 发件（以数据库枚举为准）
- `timeSort`: `0` 倒序 / `1` 正序增量

### `GET /api/email/latest`
- Query: `emailId`, `accountId`, `allReceive?`

### `GET /api/email/attList`
- Query: `emailId` 或服务支持的附件查询参数

### `POST /api/email/send`
- Body 常用字段:
- `accountId`, `name?`, `sendType`(`new`/`reply`), `emailId?`, `receiveEmail[]`, `text`, `content`, `subject`, `attachments[]`

### `PUT /api/email/read`
- Body: `emailIds` (数组)

### `DELETE /api/email/delete`
- Query: `emailIds` (逗号分隔)

## 3.6 全站邮件管理（AllEmail）

### `GET /api/allEmail/list`
- Query: `emailId?`, `size?`, `name?`, `subject?`, `accountEmail?`, `userEmail?`, `type?`, `timeSort?`
- 说明:
- `type`: `send` / `receive` / `delete` / `noone`

### `GET /api/allEmail/latest`
- Query: `emailId`

### `DELETE /api/allEmail/delete`
- Query: `emailIds` (逗号分隔)

### `DELETE /api/allEmail/batchDelete`
- Query: `sendName?`, `sendEmail?`, `toEmail?`, `subject?`, `startTime?`, `endTime?`, `type?`
- 说明:
- `type`: `left`(左匹配) / `include`(包含匹配)

## 3.7 角色与权限（Role）

### `GET /api/role/permTree`

### `GET /api/role/list`

### `GET /api/role/selectUse`

### `POST /api/role/add`
- Body: `name`, `sort?`, `sendType?`, `sendCount?`, `accountCount?`, `permIds[]`, `banEmail[]`, `availDomain[]`

### `PUT /api/role/set`
- Body: `roleId`, 其余同新增（用于更新）

### `PUT /api/role/setDefault`
- Body: `roleId`

### `DELETE /api/role/delete`
- Query: `roleId`

## 3.8 设置（Setting）

### `GET /api/setting/query`
- 需 JWT + 权限

### `GET /api/setting/websiteConfig`
- 公开接口

### `PUT /api/setting/set`
- Body: 设置项对象（例如 `title`, `register`, `resendTokens`, `domain` 相关配置等）

### `PUT /api/setting/setBackground`
- Body: `background` (URL 或 base64)

### `DELETE /api/setting/deleteBackground`

## 3.9 注册码（RegKey）

### `GET /api/regKey/list`
- Query: `code?`

### `POST /api/regKey/add`
- Body: `code`, `roleId`, `count`, `expireTime`

### `DELETE /api/regKey/delete`
- Query: `regKeyIds` (逗号分隔)

### `DELETE /api/regKey/clearNotUse`

### `GET /api/regKey/history`
- Query: `regKeyId`

## 3.10 星标（Star）

### `POST /api/star/add`
- Body: `emailId`

### `GET /api/star/list`
- Query: `emailId?`, `size?`

### `DELETE /api/star/cancel`
- Query: `emailId`

## 3.11 统计分析（Analysis）

### `GET /api/analysis/echarts`
- Query: `timeZone?`

## 3.12 OAuth

### `POST /api/oauth/linuxDo/login`
- Body: `code`
- 返回: `{ userInfo, token }`，若未绑定邮箱则 `token` 可能为 `null`

### `PUT /api/oauth/bindUser`
- Body: `email`, `oauthUserId`, `code?`

## 3.13 公共接口（Public Token 模式）

### `POST /api/public/genToken`
- Body: `email`, `password` (仅管理员)
- 返回: `{ token }`

### `POST /api/public/emailList`
- Header: `Authorization: <PUBLIC_TOKEN>`
- Body: `toEmail?`, `content?`, `subject?`, `sendName?`, `sendEmail?`, `timeSort?`, `num?`, `size?`, `type?`, `isDel?`

### `POST /api/public/addUser`
- Header: `Authorization: <PUBLIC_TOKEN>`
- Body:
```json
{
  "list": [
    {
      "email": "u1@example.com",
      "password": "123456",
      "roleName": "普通用户"
    }
  ]
}
```

## 3.14 其他接口

### `GET /api/init/:secret`
- 初始化数据库（仅首次部署/重置时使用）

### `POST /api/webhooks`
- Resend webhook 回调

### `GET /api/telegram/getEmail/:token`
- 返回 HTML 邮件内容，带缓存头

### `GET /api/oss/*`
- 资源文件访问（附件/静态资源）

## 4. cURL 快速示例

### 登录并保存 token

```bash
curl -X POST 'http://localhost:8787/api/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"123456"}'
```

### 查询邮箱列表（管理员）

```bash
curl 'http://localhost:8787/api/account/adminList?num=1&size=20&isDel=0&sortBy=createTime&sortOrder=desc' \
  -H 'Authorization: <JWT_TOKEN>'
```

### 按 email 删除邮箱（支持 account 接口）

```bash
curl -X DELETE 'http://localhost:8787/api/account/delete?email=42442@example.com' \
  -H 'Authorization: <JWT_TOKEN>'
```

### 查询某邮箱邮件（管理员全局）

```bash
curl 'http://localhost:8787/api/allEmail/list?accountEmail=42442@example.com&type=receive&size=20' \
  -H 'Authorization: <JWT_TOKEN>'
```
