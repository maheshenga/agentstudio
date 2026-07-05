import { Module, Global } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DeptModule } from './dept/dept.module';
import { SysConfigModule } from './config/config.module';
import { DictModule } from './dict/dict.module';
import { MenuModule } from './menu/menu.module';
import { PluginModule } from './plugin/plugin.module';
import { PostModule } from './post/post.module';
import { RoleModule } from './role/role.module';
import { ToolModule } from './tool/tool.module';
import { UserModule } from './user/user.module';
import { TenantModule } from './tenant/tenant.module';
import { SystemModuleRegistryModule } from '../system-module/system-module.module';

@Global()
@Module({
  imports: [
    AuthModule,
    SysConfigModule,
    DeptModule,
    DictModule,
    MenuModule,
    PluginModule,
    PostModule,
    RoleModule,
    ToolModule,
    UserModule,
    TenantModule,
    SystemModuleRegistryModule,
  ],
  exports: [
    AuthModule,
    SysConfigModule,
    DeptModule,
    DictModule,
    MenuModule,
    PluginModule,
    PostModule,
    RoleModule,
    ToolModule,
    UserModule,
    TenantModule,
    SystemModuleRegistryModule,
  ],
})
export class SystemModule {}
