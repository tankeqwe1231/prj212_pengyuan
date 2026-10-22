# AGENTS.md

本文件适用于仓库根目录及其所有子目录，供在本项目中工作的自动化编码代理使用。

## 项目定位与当前阶段

- 本项目是在 Apache Superset `0.23.0dev` 基础上长期二次开发的业务系统，不是当前版本的 Superset。仓库同时存在上游遗留代码、历史业务定制和已升级的运行时适配代码，不能只根据上游版本判断实际架构。
- 前后端升级工作已完成约 90%，当前阶段以升级收尾、兼容性修复、测试补齐和业务行为稳定为主，不再按“仅升级后端、前端保持不变”的旧目标工作。
- 后端已经运行在 Python 3.12，使用仓库本地 `uv` `.venv`。核心栈为 Flask 2.3.3、Flask-AppBuilder 4.5.3、Flask-SQLAlchemy 2.5.1、SQLAlchemy 1.4.54、Alembic 1.14.1、Flask-Migrate 4.1.0、mysqlclient 2.2.8 和 pandas 2.1.4。
- 前端已经升级为 Node 22.12.0、npm 10.9.0、React/React DOM 19.2.8、Redux 5.0.1、React-Redux 9.3.0、Redux Toolkit 2.12.0、Bootstrap 5.3.8、React-Bootstrap 2.10.10、Babel 7、Webpack 5、ESLint 8、Mocha 11 和 Testing Library。D3 仍固定在 v3，部分可视化库和业务组件仍保留旧式 API。
- 前端不是全量重写后的现代 Superset，而是“现代运行时和构建链 + 遗留 Superset 页面结构 + 本地兼容层”的混合架构。修改时必须保留现有 Jinja 页面、Webpack 多入口、旧业务组件和兼容适配行为。
- 系统元数据与二次开发业务数据共用 PostgreSQL 18，数据库实现、SQL 和迁移必须兼容 PostgreSQL 18，不能按 MySQL、SQLAlchemy 2.x 或新版 Superset 的行为编写。当前元数据库中的时间列统一使用 `timestamp without time zone`，不要重新引入 `timestamptz`。
- 除非任务明确要求，不继续升级 Python 大版本、SQLAlchemy 2.x、Flask 3.x、FAB 5.x、Node、React 或其他核心构建链，也不进行全仓格式化、无关依赖升级或现代化重构。

## 当前架构

### 后端

- `superset/__init__.py` 是 Flask 应用初始化入口，负责配置、数据库、缓存、CSRF、迁移、安全管理器、视图等对象的初始化。导入 `superset` 会产生应用初始化副作用，并可能访问元数据库、缓存、文件目录和其他配置资源。
- `superset/config.py` 是公共配置入口，并直接导入 `superset/config_private.py`。两者可能包含部署相关或敏感配置，不得在输出、日志、测试数据或提交中泄露密钥、口令、连接串、Token 和内部地址。
- 可通过 `SUPERSET_CONFIG` 指向一个 Python 配置模块。涉及应用导入、接口测试或页面冒烟时，必须先确认该模块的元数据库、缓存、上传目录和外部服务均指向隔离测试资源。
- `superset/cli.py` 和 `superset/bin/superset` 使用项目自定义的 Click `LegacyManager` 保留旧命令形状；Flask-Script 已从运行依赖中移除，本项目也没有套用新版 Superset CLI 架构。
- `superset/views/` 仍以 Flask-AppBuilder 视图和业务接口为主，重点定制包括 `core_custom.py`、`decorators_custom.py`、`difyapis/`、`qwenapis/` 等。
- `superset/models/`、`superset/connectors/`、`superset/db_engines/` 分别承载元数据模型、数据源连接器和数据库方言行为。
- `superset/models/core.py` 除 Superset 核心表外，还映射 `reports`、`task_report`、`ppt_templates`、`warn_index`、`dashboards_user_home` 等实际业务表。涉及业务表结构时，以实际 PostgreSQL 18 `public` schema 结构为最高依据。
- `superset/security.py` 已适配 FAB 4.5.3 的定制安全管理器、权限同步和数据库登录流程；`superset/sec_models_core.py`、`superset/sec_views_core.py` 定义自定义用户模型和管理视图。
- `tests/` 已纳入仓库，目前使用 Python 标准库 `unittest`，覆盖部分安全视图、SQLAlchemy URI 和 FAB 删除流程。`setup.cfg` 中的 nose 配置属于历史配置，不能据此假设存在完整的 nose 测试套件。

### 前端

- 前端规范源目录为 `superset/assets/`，主要源码位于 `javascripts/`、`visualizations/`、`stylesheets/`，测试位于 `spec/`。
- `package.json` 和 `package-lock.json` 是当前 npm 依赖与锁定结果的依据。不要使用历史 `yarn.lock`、`yarn-error.log` 或 `package-升级前对比用.json` 覆盖当前依赖状态。
- `webpack.config.js` 使用 Webpack 5 多入口构建。主要入口包括 `reactShell`、`common`、`explore`、`dashboard`、`sqllab`、`welcome`、`profile`、`custom`、`indexmanage`、`indexdatamanage`、`reportsdata` 和 `homePage`。
- 构建结果写入 `superset/assets/dist/`，并生成 `manifest.json`。后端通过 `superset/__init__.py` 和 Jinja `js_manifest()` 查找带 hash 的 JS/CSS 文件，因此修改入口、模板或 manifest 逻辑时必须同时检查前后端引用关系。
- `superset/static/assets` 是指向 `../assets` 的符号链接。只修改 `superset/assets/` 下的规范源，不要在链接两侧重复编辑，也不要用普通目录替换该链接。
- React 入口统一通过 `javascripts/modules/reactRoot.jsx` 的 `renderReact()`/`unmountReact()` 使用 React 19 `createRoot`。不要重新引入 `ReactDOM.render()`、`unmountComponentAtNode()` 或绕过根节点管理工具创建重复 root。
- 大量旧类组件行为通过 `javascripts/hooks/useLegacyComponent.js` 适配到 React 19。修改这类组件或适配器时，要关注旧生命周期、`setState` 回调、默认 props、ref 和卸载清理；不要为追求形式上的现代化批量改写仍稳定运行的组件。
- Redux store 由 `javascripts/reduxUtils.js` 的 `createAppStore()` 基于 Redux Toolkit `configureStore()` 创建，并为历史 state 和持久化逻辑关闭部分默认检查。沿用现有 action/reducer/state 结构，不要擅自切换新版 Superset 的 store 架构。
- `compat/react-select` 和 `compat/react-virtualized-select` 是保留旧 import/API 形状的本地兼容包，底层选择器使用 `react-select-modern`；历史表格兼容层已迁移为基于 `@tanstack/react-table` 的项目级 `AppTable`。修改相关依赖或组件前必须核对兼容层及所有调用方。
- 页面样式和交互以 Bootstrap 5/React-Bootstrap 2 为当前基线，Jinja/FAB 模板与历史 CSS 仍有兼容代码。新增 Bootstrap 行为使用当前 `data-bs-*` 和组件 API，但不要无任务依据批量替换历史样式。
- D3 默认仍按 v3 API 理解，不能直接使用新版 D3 API。ECharts、Deck.gl、地图和其他可视化依赖也应以 `package.json` 的实际锁定版本和相邻代码为准。
- Babel 7 当前面向 Chrome 110、Edge 110，测试环境面向当前 Node；新增语法必须确认现有 Babel 配置可编译。可以使用当前项目已经支持的函数组件和 Hooks，但不要引入未配置的 TypeScript 或照搬新版 Superset 代码。
- 前端测试使用 Mocha/Chai、jsdom 和 Testing Library，不再以 Enzyme 或 Babel 6 的测试命令为准。

## 开始工作前

1. 先阅读请求涉及模块及其直接调用方、后端视图、Jinja 模板、Webpack 入口和测试，不要只修改搜索命中的第一处。
2. 执行 `git status --short --branch` 检查现有变更并保留用户改动；不得回滚、覆盖或清理与当前任务无关的文件。
3. 识别上游遗留代码、业务定制代码与升级兼容层的边界，优先沿用附近现有实现，避免扩大补丁。
4. 后端命令必须使用仓库根目录 `.venv` 中的 Python，通过 `uv run --locked` 或 `.venv\Scripts\python.exe` 执行。不得使用 Anaconda、系统 Python 或升级前的旧环境验证当前代码。
5. 前端命令必须在 `superset/assets` 下执行，并使用 `package.json` 固定的 Node 22.12.0 和 npm 10.9.0。不要因本机全局 Node/npm 不一致而修改锁文件或批量修复代码。
6. 在任何应用导入、数据库命令、权限同步、上传或外部集成测试前，先确认目标资源是隔离测试资源。目标不明确时停止执行并向用户说明。

## 安装、启动与构建

### Python 环境

- `pyproject.toml` 是 Python 3.12 升级后直接依赖和版本范围的来源，`uv.lock` 是可复现锁文件；依赖变更后必须同时更新并验证两者。
- `requirements.txt` 保留为升级前 Python 3.6.5 环境的对照基线，不能用它安装或覆盖当前 `.venv`。
- 项目通过 `pyproject.toml` 的 setuptools 配置由 `uv sync` 以可编辑方式安装，修改 Python 源码后通常不需要重新安装。
- `.venv` 没有 `pip` 模块属于正常情况。列包使用 `uv pip list --python .venv\Scripts\python.exe`，不要为了检查环境擅自安装 pip。
- pandas 保持在 2.1.x；本阶段固定 SQLAlchemy 1.4，不要升级到要求 SQLAlchemy 2.0 的 pandas 版本。

PowerShell 中可使用：

```powershell
$env:UV_CACHE_DIR = "$PWD\.uv-cache"
uv sync --locked --python 3.12
uv run --locked python --version
uv pip list --python .venv\Scripts\python.exe
```

也可直接执行：

```powershell
& '.\.venv\Scripts\python.exe' --version
& '.\.venv\Scripts\python.exe' superset\bin\superset --help
```

### 后端启动与数据库命令

标准本地后端入口为：

```powershell
& '.\.venv\Scripts\python.exe' superset\bin\superset runserver -d
```

等价的 uv 命令为：

```powershell
uv run --locked python superset\bin\superset runserver -d
```

- CLI 默认地址和端口来自配置，目前公共配置的 `SUPERSET_WEBSERVER_PORT` 为 `8888`。`superset/run.py` 中仍有固定 `8888` 的遗留直接启动方式，不作为标准入口，也不要继续在业务代码或调试配置中写死端口。
- `superset init`、创建管理员、导入示例数据、迁移升级和权限同步会修改元数据库，只能在明确隔离的本地/测试库执行。
- Alembic 历史已于 2026-09-05 以实际 PostgreSQL 18 结构重建，当前唯一 base/head 为 `20260905_postgresql18`。baseline 仅用于全新空库，禁止对已有业务库执行其 `upgrade()`。
- 当前业务库的 `alembic_version` 若仍记录历史 MySQL revision，必须先完成备份、结构比对和 PostgreSQL 测试副本验证，再按部署方案切换到 `20260905_postgresql18`；未经明确授权不得对当前库执行 `stamp` 或直接修改 `alembic_version`。

### 前端依赖与命令限制

- 优先复用当前 `node_modules/`。确需重新安装时以 `package-lock.json` 为准使用 npm；除非任务明确涉及依赖，不运行依赖升级命令，不改写锁文件。
- **自动化编码代理禁止执行 `npm run dev` 和 `npm run build`。** 这两条命令由用户在终端中自行执行。
- 禁止通过等价命令绕过上述限制，包括 `npm run prod`、直接调用 `webpack`/`webpack-cli`、`npx webpack` 或其他会生成生产/开发 bundle 的命令。
- 如果页面测试或联调需要启动前端监听构建，告诉用户进入 `superset/assets` 后执行 `npm run dev` 即可，并等待用户确认已启动；代理不得代替用户启动。
- 如果任务需要生产构建验证，最终说明中明确请用户手动执行 `npm run build`，不得声称未由代理执行的构建已经通过。
- Webpack 5 配置启用了 `output.clean`，构建会清理并重建 `superset/assets/dist/`。该目录是忽略的生成物，不直接编辑、不提交，也不以其中当前文件是否存在判断源码是否正确。
- 后端页面依赖 `dist/manifest.json`。用户未启动监听构建或未完成生产构建时，页面可能仍加载旧 bundle；应把这一点作为手工冒烟验证的前置条件说明清楚。

## 编码约定

### Python / Flask / SQLAlchemy

- 沿用目标文件现有风格：UTF-8、4 空格缩进、现有 import 顺序和命名方式。不要为无关代码补类型标注、改引号或大范围整理 import。
- 所有后端代码必须兼容 Python 3.12、Flask 2.3、FAB 4.5 和 SQLAlchemy 1.4。不要套用 Flask 3、FAB 5、SQLAlchemy 2 或新版 Superset 的 API。
- FAB 视图继续遵循现有 `expose`、权限装饰器、响应格式和注册方式；新增视图时确认其模块会由 `superset/views/__init__.py` 或其他启动路径导入。
- 权限、CSRF、行级/数据源访问控制属于安全边界。新增或修改接口时沿用相邻接口的权限装饰器，并覆盖未登录、无权限和异常分支；不得为通过测试而扩大 CSRF 豁免。
- SQLAlchemy 写操作要有明确事务边界，异常路径应回滚 session，避免部分提交。ORM 结构变化必须附带新的 Alembic 迁移，不能把模型修改视为数据库已自动变更。
- 不修改 baseline 或已有迁移来表达新变化。新迁移的 `down_revision` 必须从当前 head 延续，并在一次性 PostgreSQL 18 测试数据库中检查升级和降级路径。
- 不在日志或异常响应中输出连接串、敏感 SQL 参数、用户凭证、Token 或第三方服务密钥。

### FAB 权限与用户模型

- 当前安全管理器为 `superset.security.SupersetSecurityManager`，使用 `UserCustom`、`UserCustomModelView` 和 `AuthDBViewCustom`。权限或登录变更必须同时检查 `superset/security.py`、`superset/sec_models_core.py`、`superset/sec_views_core.py`、相关模板和权限装饰器。
- FAB 核心权限关系为：`ab_user` ↔ `ab_user_role` ↔ `ab_role` ↔ `ab_permission_view_role` ↔ `ab_permission_view`，后者关联 `ab_permission` 和 `ab_view_menu`。不得绕过关联表直接拼装权限，也不要假设新版 FAB 表结构。
- `ab_user` 除 FAB 字段外还有 `dept`、`expire_date`、`mobile_phone`、`person_contact`、`home_dash_id`、`agree_time`、`agree_ip` 等业务字段。变更用户模型时同时核对 ORM、自定义视图、登录逻辑和实际表结构。
- FAB 4.5.3 ORM 将 `ab_view_menu.name` 定义为 `VARCHAR(250)`、`ab_user.email` 定义为 `VARCHAR(320)`，当前 PostgreSQL 18 实表仍分别为 `VARCHAR(100)` 和 `VARCHAR(64)`。在专门迁移修复前不要自动改表；未来迁移仍需在 PostgreSQL 18 副本验证字段和唯一索引。
- `用户权限元数据表信息/*.sql` 是历史 MySQL 5.7 权限表结构快照，不是当前 PostgreSQL 18 结构，其中包含 `DROP TABLE`、外键和当时的 `AUTO_INCREMENT` 值，只能用于历史分析比对，禁止直接执行或作为迁移脚本。
- `superset init` 会调用 `sync_role_definitions()`，可能大量增删或重建权限记录。修改权限名称、视图名称、角色规则或同步逻辑时，要评估既有角色授权，并仅在备份后的测试副本验证。
- 判断当前结构时，以 PostgreSQL 18 `public` schema 实际结构为最高依据，历史 MySQL 快照为辅助比对依据，FAB 4.5.3 模型和项目 ORM 为代码依据；三者不一致时先报告，不擅自自动对齐。

### PostgreSQL 元数据与业务表

- 新迁移必须使用 PostgreSQL 18 支持的类型、默认值、索引、外键和 DDL。当前元数据库使用 `public` schema；时间字段使用 `timestamp without time zone`，除非任务明确要求，不要引入 `timestamp with time zone`/`timestamptz`。
- 修改 `superset/models/core.py` 前，搜索模型在 views、templates、序列化、导入导出和前端接口中的全部引用，并核对相应迁移。
- 不使用 `db.create_all()`、导出的 `DROP TABLE/CREATE TABLE` SQL 或手工改生产表代替迁移。
- 涉及破坏性 DDL、数据回填、权限重建或大表索引时，先提供备份、回滚和分批执行方案，并取得明确授权；时间类型转换必须核对 session 时区和数据值是否发生偏移。

### JavaScript / React / Redux

- 遵守当前 `.eslintrc` 及项目已有豁免，使用 Babel 7 可编译、目标浏览器支持的语法。不要因为 ESLint 规则已放宽而批量改动历史代码格式。
- 新增 React 挂载点使用 `renderReact()`；新增组件可使用函数组件和 Hooks。修改遗留组件时优先保持现有 `useLegacyComponent` 适配方式，除非任务本身要求重构。
- 保持现有 Redux action/reducer/state 形状，创建 store 使用 `createAppStore()`。不要直接复制新版 Superset 的 Redux、路由、主题或 API 客户端架构。
- 对 `react-select`、`react-virtualized-select` 的修改应先判断调用的是本地兼容包还是现代底层包；表格新增或迁移统一使用 `javascripts/components/AppTable/AppTable.jsx` 的行对象和 TanStack column definitions，避免恢复已移除的旧表格 API。
- React-Bootstrap 和原生 Bootstrap 插件并存。修改弹窗、下拉、折叠和提示组件时检查 JSX、`reactShell.js`、Jinja DOM 属性与历史 CSS 的共同影响。
- D3 代码按 v3 API 处理。新增或调整可视化时同时检查 `visualizations/main.js`、控件配置、缩略图、模板/入口引用和相关测试。
- 面向用户的中文文案保持 UTF-8；不要修正无关文件中的历史乱码或批量替换文案。

### 模板与静态资源

- 修改基础模板时检查标准版、`_for_client`、登录页、首页、报表页等对应变体，避免只修复一个入口。
- 修改模板引用的前端 entry 时，同时核对 `webpack.config.js` entry 名称和 manifest key。
- 所有进入 Jinja/HTML 的用户数据按现有安全方式转义；不要无依据使用 `safe`、拼接脚本或关闭净化。
- 不直接编辑 `dist/`、压缩文件、第三方 vendor 代码或 hash 文件实现功能；应修改规范源文件，再由用户执行构建。
- 仓库存在名称含“副本”或“升级前对比用”的历史文件。除非请求明确要求清理，不删除、不重命名，也不要把它们当作当前配置来源。

## 测试与验证

按变更范围选择最小但充分的验证，并在最终说明中列出实际运行的命令及结果。不要声称未运行的检查已通过。

### 浏览器登录与角色覆盖

- 内置浏览器访问本地开发环境时，如果尚未登录或登录会话已经超时，应根据待测页面对应的角色主动登录，不要因停留在登录页而中止页面读取或浏览器冒烟。
- 本地开发环境管理员账号为 `admin`，密码为 `a4vB0uga`；普通用户测试账号为 `wangfang`，密码为 `wf888888`。这些凭据仅用于本项目本地开发环境，不得用于其他环境，也不得写入日志、截图、测试数据或业务代码。
- 管理员登录后访问的页面通常使用 FAB 默认模板，包括 `add`、`edit`、`show` 等管理页面；验证这类管理员页面时使用 `admin`。
- 普通用户登录后访问的页面主要使用 `explore`、`dashboard` 路由相关模板；验证普通用户业务页面时使用 `wangfang`。
- 特殊例外：普通用户“图表”菜单对应 `slicemodelview/list/` 路由，该页面仍使用 FAB 类模板。测试时应按实际访问角色使用 `wangfang`，不能仅因页面使用 FAB 模板就改用管理员账号。
- 涉及共享基础模板、导航、权限可见性或不同角色页面差异时，应分别使用两个账号验证；切换角色前先退出当前账号或清理当前站点会话，避免沿用错误角色的登录状态。

### 后端验证

后端语法检查使用项目 `.venv`：

```powershell
& '.\.venv\Scripts\python.exe' -m compileall <变更路径>
```

现有标准库测试可运行：

```powershell
& '.\.venv\Scripts\python.exe' -m unittest discover -s tests -v
```

- `compileall` 只检查语法，不能替代应用级测试。
- 部分测试通过文件路径隔离加载模块，部分测试会正常导入 `superset`。运行全量或涉及应用导入的测试前，必须设置安全的 `SUPERSET_CONFIG` 并确认没有连接真实元数据库或外部服务。
- 涉及 FAB 权限时，至少覆盖未登录用户、普通用户、不同角色、管理员、过期用户以及权限同步前后的行为；使用 PostgreSQL 18 测试库副本，不直接复用生产元数据。
- Dify、Qwen、OSS、邮件、数据库和其他外部集成默认使用 mock/stub；未经明确授权不发送真实请求、不上传文件、不触发实际任务。

### 前端验证

代理可以在 `superset/assets` 下执行：

```powershell
npm run lint
npm test
```

单个前端测试可使用当前 Babel 7/Mocha 配置：

```powershell
$env:BABEL_ENV = 'test'
.\node_modules\.bin\mocha.cmd --require @babel/register --require ignore-styles --require spec/helpers/browser.js spec/javascripts/path/to/file_spec.jsx
```

- 新增或修改前端行为时，在 `superset/assets/spec/` 下添加或更新对应 `*_spec.js`/`*_spec.jsx`，优先沿用 Testing Library 和相邻测试写法。
- `npm test` 和单测不生成页面 bundle。需要页面联调时，请用户手动执行 `npm run dev`；需要生产 bundle 验证时，请用户手动执行 `npm run build`。
- 自动化代理的前端完成标准是相关 lint 和测试通过，并清楚列出仍需用户手动完成的监听构建、生产构建或浏览器冒烟；不得自行执行 `npm run dev`/`npm run build`。

## 禁止默认修改的内容

除非用户任务直接涉及，下列内容视为依赖、生成物、运行数据、敏感配置或业务资产：

- `superset/assets/node_modules/`
- `superset/assets/dist/`
- `superset_legacy_py312.egg-info/`、`superset.egg-info/`
- `__pycache__/`、覆盖率文件和日志
- `superset/views/reports_upload/` 中的上传文件
- `superset/views/ppt_template/`、`superset/assets/docs/` 中的业务文档和模板
- 图片、字体、压缩脚本、CKEditor 及其他第三方 vendor 资源
- `superset/config.py`、`superset/config_private.py` 中的部署配置和任何真实数据库文件、Token、证书、密钥
- `用户权限元数据表信息/*.sql` 结构快照，除非任务明确要求重新导出或更新文档
- `superset/assets/package-升级前对比用.json`、`yarn-error.log` 等历史对照文件

## 完成标准

- 变更只覆盖请求范围，保留遗留 Superset、当前升级兼容层和现有业务行为。
- 新增或修改逻辑有匹配测试；无法自动验证的部分说明原因、风险和用户手工验证方法。
- 后端使用 Python 3.12 `.venv` 验证；前端使用锁定的 Node/npm 执行相关 lint 和测试。
- 代理没有执行 `npm run dev`、`npm run build` 或等价 Webpack 构建命令；需要构建时已明确交由用户手动执行。
- 数据库、权限、CSRF、文件上传、外部请求和模板输出的安全影响已检查。
- 没有提交临时文件、密钥、运行数据、无关格式化、意外锁文件变化或不必要的构建产物。
