import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { TaixuRetrievalInvokeDto } from './dto';
import { TaixuRetrievalService } from './taixu-retrieval.service';
import { initTaixuSse, writeTaixuSse } from '../stream/taixu-sse.util';

@Controller('api/taixu')
export class TaixuRetrievalController {
  constructor(private readonly retrievalService: TaixuRetrievalService) {}

  /**
   * 流式写入 SSE 响应。
   * 初始化 SSE 连接，遍历异步生成器产生的帧数据，逐帧推送给客户端。
   * @param req - Express 请求对象，用于监听连接关闭
   * @param res - Express 响应对象，用于 SSE 推送
   * @param generator - 异步生成器，产出事件/思考/数据帧
   */
  private async writeStream(req: Request, res: Response, generator: AsyncGenerator<{ type: 'event' | 'think' | 'data'; payload: string }>) {
    const abort = initTaixuSse(req, res);
    try {
      for await (const frame of generator) {
        if (abort.signal.aborted) break;
        writeTaixuSse(res, frame.type, frame.payload);
      }
    } finally {
      res.end();
    }
  }

  @Post('retrieval/rag')
  async rag(@Body() body: TaixuRetrievalInvokeDto, @Req() req: Request, @Res() res: Response) {
    return this.writeStream(req, res, this.retrievalService.invokeRag(body));
  }

  @Post('retrieval/advance')
  async advance(@Body() body: TaixuRetrievalInvokeDto, @Req() req: Request, @Res() res: Response) {
    return this.writeStream(req, res, this.retrievalService.invokeAdvance(body));
  }

  @Post('special/rag')
  async special(@Body() body: TaixuRetrievalInvokeDto, @Req() req: Request, @Res() res: Response) {
    return this.writeStream(req, res, this.retrievalService.invokeSpecial(body));
  }

  @Post('program/retrieve')
  async program(@Body() body: TaixuRetrievalInvokeDto, @Req() req: Request, @Res() res: Response) {
    return this.writeStream(req, res, this.retrievalService.invokeProgram(body));
  }

  @Post('arxiv/retrieve')
  async arxiv(@Body() body: TaixuRetrievalInvokeDto, @Req() req: Request, @Res() res: Response) {
    return this.writeStream(req, res, this.retrievalService.invokeArxiv(body));
  }
}
