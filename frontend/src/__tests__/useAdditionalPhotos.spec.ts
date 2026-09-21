import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  reorderAdditionalPhotos,
  uploadAdditionalPhotos,
} from '@/api/goods'
import { useAdditionalPhotos } from '@/views/goods-form/composables/useAdditionalPhotos'
import type {
  GoodsAdditionalPhotosUploadResponse,
  GoodsDetail,
  GuziImage,
} from '@/api/types'

vi.mock('@/api/goods', () => ({
  deleteAdditionalPhoto: vi.fn(),
  reorderAdditionalPhotos: vi.fn(),
  updateAdditionalPhotoLabel: vi.fn(),
  uploadAdditionalPhotos: vi.fn(),
}))

const makePhoto = (id: number, label = ''): GuziImage => ({
  id,
  image: `/media/${id}.jpg`,
  label,
  order: id,
})

const makeDetail = (photos: GuziImage[]): GoodsDetail => ({
  id: 'goods-1',
  name: '测试谷子',
  ip: { id: 1, name: '测试IP' },
  characters: [],
  category: {
    id: 1,
    name: '测试品类',
    parent: null,
    path_name: '测试品类',
    order: 1,
  },
  location_path: '',
  status: 'in_cabinet',
  quantity: 1,
  is_official: false,
  location: null,
  created_at: '',
  updated_at: '',
  additional_photos: photos,
})

const makeUploadDetail = (
  photos: GuziImage[],
  createdPhotoIds: number[],
): GoodsAdditionalPhotosUploadResponse => ({
  ...makeDetail(photos),
  created_photo_ids: createdPhotoIds,
})

describe('useAdditionalPhotos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn((file: File) => `blob:${file.name}`),
      revokeObjectURL: vi.fn(),
    })
  })

  it('moves saved and pending photos in one shared order', () => {
    const photos = useAdditionalPhotos(ref('goods-1'))
    photos.setExistingPhotos([makePhoto(1), makePhoto(2)])
    photos.addNewPhotoFile(new File(['a'], 'a.jpg'))
    photos.addNewPhotoFile(new File(['b'], 'b.jpg'))

    photos.moveAdditionalPhoto(2, 0)

    expect(
      photos.additionalPhotoItems.value.map((item) =>
        item.kind === 'local' ? item.file.name : item.id,
      ),
    ).toEqual(['a.jpg', 1, 2, 'b.jpg'])
  })

  it('uploads pending photos in display order and persists the full id order', async () => {
    vi.mocked(uploadAdditionalPhotos)
      .mockResolvedValueOnce(makeUploadDetail(
        [makePhoto(1), makePhoto(2), makePhoto(10, 'A')],
        [10],
      ))
      .mockResolvedValueOnce(makeUploadDetail([
        makePhoto(1),
        makePhoto(2),
        makePhoto(10, 'A'),
        makePhoto(11, 'B'),
      ], [11]))
    vi.mocked(reorderAdditionalPhotos).mockResolvedValue(
      makeDetail([makePhoto(10), makePhoto(1), makePhoto(11), makePhoto(2)]),
    )

    const photos = useAdditionalPhotos(ref('goods-1'))
    photos.setExistingPhotos([makePhoto(1), makePhoto(2)])
    photos.addNewPhotoFile(new File(['a'], 'a.jpg'))
    photos.addNewPhotoFile(new File(['b'], 'b.jpg'))
    photos.moveAdditionalPhoto(2, 0)
    photos.moveAdditionalPhoto(3, 2)

    await photos.handleAdditionalPhotosUpload('goods-1')
    await photos.persistAdditionalPhotoOrder('goods-1')

    expect(vi.mocked(uploadAdditionalPhotos).mock.calls.map((call) => call[1]?.[0]?.name))
      .toEqual(['a.jpg', 'b.jpg'])
    expect(reorderAdditionalPhotos).toHaveBeenCalledWith(
      'goods-1',
      [10, 1, 11, 2],
    )
  })

  it('keeps successful uploads as saved photos so retry cannot duplicate them', async () => {
    vi.mocked(uploadAdditionalPhotos)
      .mockResolvedValueOnce(makeUploadDetail([makePhoto(10, 'A')], [10]))
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(makeUploadDetail(
        [makePhoto(10, 'A'), makePhoto(11, 'B')],
        [11],
      ))

    const photos = useAdditionalPhotos(ref('goods-1'))
    photos.addNewPhotoFile(new File(['a'], 'a.jpg'))
    photos.addNewPhotoFile(new File(['b'], 'b.jpg'))

    await expect(photos.handleAdditionalPhotosUpload('goods-1')).rejects.toThrow('network')
    expect(photos.additionalPhotoItems.value.map((item) => item.kind))
      .toEqual(['personal', 'local'])

    await photos.handleAdditionalPhotosUpload('goods-1')

    expect(vi.mocked(uploadAdditionalPhotos)).toHaveBeenCalledTimes(3)
    expect(vi.mocked(uploadAdditionalPhotos).mock.calls.map((call) => call[1]?.[0]?.name))
      .toEqual(['a.jpg', 'b.jpg', 'b.jpg'])
    expect(photos.additionalPhotoItems.value.map((item) =>
      item.kind === 'local' ? item.file.name : item.id,
    )).toEqual([10, 11])
  })

  it('maps club source photos to copied personal photos without losing order', () => {
    const photos = useAdditionalPhotos(ref(undefined))
    photos.setExistingPhotos(
      [makePhoto(101), makePhoto(102), makePhoto(103)],
      { kind: 'club-source' },
    )
    photos.addNewPhotoFile(new File(['local'], 'local.jpg'))
    photos.moveAdditionalPhoto(2, 0)
    const source102 = photos.additionalPhotoItems.value.find(
      (item) => item.kind === 'club-source' && item.id === 102,
    )
    expect(source102).toBeDefined()
    photos.handleRemoveAdditionalPhoto(source102!)

    photos.adoptClubSourcePhotos(
      [makePhoto(13), makePhoto(11)],
      [103, 101],
    )

    expect(photos.additionalPhotoItems.value.map((item) =>
      item.kind === 'local' ? item.file.name : item.id,
    )).toEqual([13, 11, 'local.jpg'])
  })

  it('hydrates merged target photos before uploading local files', async () => {
    vi.mocked(uploadAdditionalPhotos).mockResolvedValueOnce(makeUploadDetail(
      [makePhoto(100), makePhoto(101), makePhoto(12, '新图')],
      [12],
    ))

    const photos = useAdditionalPhotos(ref(undefined))
    photos.addNewPhotoFile(new File(['local'], 'local.jpg'))
    photos.hydrateMergedPhotos([makePhoto(100), makePhoto(101)])

    await photos.handleAdditionalPhotosUpload('goods-1')
    await photos.persistAdditionalPhotoOrder('goods-1')

    expect(reorderAdditionalPhotos).toHaveBeenCalledWith(
      'goods-1',
      [100, 101, 12],
    )
  })
})
