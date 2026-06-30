import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArticleService } from './article.service';
import { ArticleController } from './article.controller';
import { ArticleEntity } from './entities/article.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ArticleEntity])],
  controllers: [ArticleController],
  providers: [ArticleService],
})
export class ArticleModule {}
