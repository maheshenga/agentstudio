import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AppFactoryTemplateEntity } from '../entities/app-factory-template.entity';
import { AppFactoryTemplateService } from './app-factory-template.service';

describe('AppFactoryTemplateService', () => {
  let service: AppFactoryTemplateService;

  const templateRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppFactoryTemplateService,
        { provide: getRepositoryToken(AppFactoryTemplateEntity), useValue: templateRepo },
      ],
    }).compile();

    service = module.get(AppFactoryTemplateService);
  });

  it('lists active templates by sort order', async () => {
    templateRepo.find.mockResolvedValue([
      {
        id: 1,
        code: 'job_board',
        name: 'Job Board',
        category: 'Recruitment',
        htmlContent: '<section>Jobs</section>',
        cssContent: '.jobs{}',
        status: 1,
        sort: 20,
      },
    ]);

    await expect(service.listTemplates({})).resolves.toEqual([
      expect.objectContaining({
        code: 'job_board',
        name: 'Job Board',
        category: 'Recruitment',
        html_content: '<section>Jobs</section>',
        css_content: '.jobs{}',
        status: 1,
      }),
    ]);
    expect(templateRepo.find).toHaveBeenCalledWith(expect.objectContaining({ order: { sort: 'ASC', id: 'ASC' } }));
  });

  it('filters templates by keyword and category', async () => {
    templateRepo.find.mockResolvedValue([]);

    await service.listTemplates({ keyword: 'job', category: 'Recruitment' });

    expect(templateRepo.find).toHaveBeenCalled();
    expect(JSON.stringify(templateRepo.find.mock.calls[0][0].where)).toContain('Recruitment');
    expect(JSON.stringify(templateRepo.find.mock.calls[0][0].where)).toContain('%job%');
  });

  it('returns a template detail by code', async () => {
    templateRepo.findOne.mockResolvedValue({
      id: 1,
      code: 'landing_page',
      name: 'Landing Page',
      status: 1,
      defaultVisibility: 'marketplace',
    });

    await expect(service.getTemplate('landing_page')).resolves.toMatchObject({
      code: 'landing_page',
      name: 'Landing Page',
      default_visibility: 'marketplace',
    });
  });

  it('throws when template detail is missing', async () => {
    templateRepo.findOne.mockResolvedValue(null);

    await expect(service.getTemplate('missing_template')).rejects.toBeInstanceOf(NotFoundException);
  });
});
