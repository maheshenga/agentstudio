import { Module } from '@nestjs/common';

import { TaixuCommonModule } from './common/taixu-common.module';
import { TaixuHomeModule } from './home/taixu-home.module';
import { TaixuUserModule } from './user/taixu-user.module';
import { TaixuModelModule } from './model/taixu-model.module';
import { TaixuSettingModule } from './setting/taixu-setting.module';
import { TaixuHistoryModule } from './history/taixu-history.module';
import { TaixuDocumentModule } from './document/taixu-document.module';
import { TaixuLlmModule } from './llm/taixu-llm.module';
import { TaixuVectorModule } from './vector/taixu-vector.module';
import { TaixuRetrievalModule } from './retrieval/taixu-retrieval.module';
import { TaixuGraphModule } from './graph/taixu-graph.module';
import { TaixuAgentModule } from './agent/taixu-agent.module';
import { TaixuModalModule } from './modal/taixu-modal.module';
import { TaixuAgenticModule } from './agentic/taixu-agentic.module';

@Module({
  imports: [
    TaixuCommonModule,
    TaixuHomeModule,
    TaixuUserModule,
    TaixuModelModule,
    TaixuSettingModule,
    TaixuHistoryModule,
    TaixuDocumentModule,
    TaixuLlmModule,
    TaixuVectorModule,
    TaixuGraphModule,
    TaixuRetrievalModule,
    TaixuAgentModule,
    TaixuModalModule,
    TaixuAgenticModule,
  ],
})
export class TaixuModule {}
