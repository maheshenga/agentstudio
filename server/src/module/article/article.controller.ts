import { Controller, Get, Post, Body, Put, Param, Query, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { ArticleService } from './article.service';
import { CreateArticleDto, UpdateArticleDto, ListArticleDto } from './dto/index';
import { User } from '../system/user/user.decorator';
import type { UserDto } from '../system/user/user.decorator';

@ApiTags('文章管理')
@Controller('api/article')
@ApiBearerAuth('Authorization')
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @ApiOperation({ summary: '文章列表' })
  @Get('list')
  findAll(@Query() query: ListArticleDto, @User() user: UserDto) {
    return this.articleService.findAll(query, user?.user);
  }

  @ApiOperation({ summary: '文章详情' })
  @Get('detail/:id')
  findOne(@Param('id') id: string, @User() user: UserDto) {
    return this.articleService.findOne(+id, user?.user);
  }

  @ApiOperation({ summary: '创建文章' })
  @ApiBody({ type: CreateArticleDto, required: true })
  @Post('create')
  create(@Body() createArticleDto: CreateArticleDto, @User() user: UserDto) {
    return this.articleService.create(createArticleDto, user?.user);
  }

  @ApiOperation({ summary: '更新文章' })
  @ApiBody({ type: UpdateArticleDto, required: true })
  @Put('update/:id')
  update(@Param('id') id: string, @Body() updateArticleDto: UpdateArticleDto, @User() user: UserDto) {
    updateArticleDto.id = +id;
    return this.articleService.update(updateArticleDto, user?.user);
  }

  @ApiOperation({ summary: '删除文章' })
  @Delete('delete')
  remove(@Body() body: { ids: number[] }, @User() user: UserDto) {
    return this.articleService.remove(body.ids, user?.user);
  }

  @ApiOperation({ summary: '更新文章状态' })
  @Put('status/:id')
  updateStatus(@Param('id') id: string, @Body() body: { status: number }, @User() user: UserDto) {
    return this.articleService.updateStatus(+id, body.status, user?.user);
  }
}
