import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SavedSearchRecord, SavedSearchService, SavedSearchUpsertRequest } from './saved-search.service';

describe('SavedSearchService', () => {
  let service: SavedSearchService;
  let httpMock: HttpTestingController;

  const upsertRequest: SavedSearchUpsertRequest = {
    name: 'Cancer criteria',
    description: 'owned search',
    visibility: 'private',
    criteriaJson: { condition: 'cancer' },
  };

  const savedSearch: SavedSearchRecord = {
    id: 9,
    ownerUserId: 1,
    ownerUsername: 'alice',
    name: 'Cancer criteria',
    description: 'owned search',
    visibility: 'private',
    criteriaJson: { condition: 'cancer' },
    createdAt: '2026-04-10T00:00:00.000Z',
    updatedAt: '2026-04-10T00:00:00.000Z',
    permissions: {
      isOwner: true,
      canView: true,
      canRun: true,
      canEdit: true,
    },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(SavedSearchService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('creates a saved search', async () => {
    const response = firstValueFrom(service.create(upsertRequest));

    const request = httpMock.expectOne('/api/saved-searches');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(upsertRequest);
    request.flush(savedSearch);

    await expect(response).resolves.toEqual(savedSearch);
  });

  it('lists owned and shared saved searches', async () => {
    const mineResponse = firstValueFrom(service.listMine());
    const mineRequest = httpMock.expectOne('/api/saved-searches');
    expect(mineRequest.request.method).toBe('GET');
    mineRequest.flush([savedSearch]);

    const sharedResponse = firstValueFrom(service.listSharedWithMe());
    const sharedRequest = httpMock.expectOne('/api/saved-searches/shared-with-me');
    expect(sharedRequest.request.method).toBe('GET');
    sharedRequest.flush([]);

    await expect(mineResponse).resolves.toEqual([savedSearch]);
    await expect(sharedResponse).resolves.toEqual([]);
  });

  it('loads, updates, and deletes by id', async () => {
    const getResponse = firstValueFrom(service.getById(9));
    const getRequest = httpMock.expectOne('/api/saved-searches/9');
    expect(getRequest.request.method).toBe('GET');
    getRequest.flush(savedSearch);

    const updateResponse = firstValueFrom(service.update(9, upsertRequest));
    const updateRequest = httpMock.expectOne('/api/saved-searches/9');
    expect(updateRequest.request.method).toBe('PUT');
    expect(updateRequest.request.body).toEqual(upsertRequest);
    updateRequest.flush({ ...savedSearch, name: 'Updated' });

    const deleteResponse = firstValueFrom(service.delete(9));
    const deleteRequest = httpMock.expectOne('/api/saved-searches/9');
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(null);

    await expect(getResponse).resolves.toEqual(savedSearch);
    await expect(updateResponse).resolves.toEqual({ ...savedSearch, name: 'Updated' });
    await expect(deleteResponse).resolves.toBeNull();
  });

  it('shares a saved search', async () => {
    const shareRequest = { username: 'bob', canView: true, canRun: true, canEdit: false };
    const response = firstValueFrom(service.share(9, shareRequest));

    const request = httpMock.expectOne('/api/saved-searches/9/share');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(shareRequest);
    request.flush({
      savedSearchId: 9,
      userId: 2,
      username: 'bob',
      canView: true,
      canRun: true,
      canEdit: false,
      createdAt: '2026-04-10T00:00:00.000Z',
    });

    await expect(response).resolves.toMatchObject({ username: 'bob', canEdit: false });
  });
});
