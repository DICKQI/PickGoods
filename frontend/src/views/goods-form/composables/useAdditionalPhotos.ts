import { computed, ref, type Ref } from 'vue'
import { ElMessage, ElMessageBox, type UploadFile } from 'element-plus'
import {
  deleteAdditionalPhoto,
  reorderAdditionalPhotos,
  updateAdditionalPhotoLabel,
  uploadAdditionalPhotos,
} from '@/api/goods'
import type {
  GoodsAdditionalPhotosUploadResponse,
  GuziImage,
} from '@/api/types'

export interface PersonalPhoto extends GuziImage {
  kind: 'personal'
  key: string
  label: string
  originalLabel: string
}

export interface ClubSourcePhoto {
  kind: 'club-source'
  key: string
  id: number
  image: string
  label: string
  originalLabel: string
  order: number
  sourceIndex: number
}

export interface NewPhotoFile {
  kind: 'local'
  key: string
  clientUploadId: string
  file: File
  preview: string
  label: string
}

export type AdditionalPhotoItem = PersonalPhoto | ClubSourcePhoto | NewPhotoFile
export type ExistingPhoto = PersonalPhoto | ClubSourcePhoto

interface ExistingPhotoInput {
  id: number
  image: string
  label?: string | null
  order?: number
}

interface SetExistingPhotosOptions {
  kind?: 'personal' | 'club-source'
}

let photoKeySequence = 0

const createPhotoKey = (prefix: string) => {
  photoKeySequence += 1
  return `${prefix}-${Date.now()}-${photoKeySequence}`
}

const createClientUploadId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return createPhotoKey('upload')
}

const toPersonalPhoto = (photo: GuziImage, key?: string): PersonalPhoto => ({
  ...photo,
  kind: 'personal',
  key: key || `personal-${photo.id}`,
  label: photo.label || '',
  originalLabel: photo.label || '',
})

export function useAdditionalPhotos(goodsId: Ref<string | undefined>) {
  const additionalPhotoItems = ref<AdditionalPhotoItem[]>([])
  const additionalPhotoList = ref<UploadFile[]>([])

  const existingAdditionalPhotos = computed<ExistingPhoto[]>(() =>
    additionalPhotoItems.value.filter(
      (item): item is ExistingPhoto => item.kind !== 'local',
    ),
  )
  const newAdditionalPhotoFiles = computed<NewPhotoFile[]>(() =>
    additionalPhotoItems.value.filter(
      (item): item is NewPhotoFile => item.kind === 'local',
    ),
  )
  const additionalPhotoPreviewSources = computed(() =>
    additionalPhotoItems.value.map((item) =>
      item.kind === 'local' ? item.preview : item.image,
    ),
  )

  const revokePreview = (item: NewPhotoFile) => {
    if (item.preview && item.preview.startsWith('blob:')) {
      URL.revokeObjectURL(item.preview)
    }
  }

  const handleAdditionalPhotoChange = (uploadFile: UploadFile) => {
    const file = uploadFile.raw
    if (file) {
      addNewPhotoFile(file)
    }
    additionalPhotoList.value = []
  }

  const addNewPhotoFile = (
    file: File,
    options?: { label?: string; preview?: string },
  ) => {
    const preview = options?.preview || URL.createObjectURL(file)
    additionalPhotoItems.value.push({
      kind: 'local',
      key: createPhotoKey('local'),
      clientUploadId: createClientUploadId(),
      file,
      preview,
      label: options?.label ?? '',
    })
  }

  const handleAdditionalPhotoRemove = () => {
    additionalPhotoList.value = []
  }

  const removeLocalPhotoByKey = (key: string) => {
    const index = additionalPhotoItems.value.findIndex(
      (item) => item.key === key && item.kind === 'local',
    )
    if (index < 0) return
    const [removed] = additionalPhotoItems.value.splice(index, 1)
    if (removed?.kind === 'local') {
      revokePreview(removed)
    }
  }

  const handleRemoveNewPhoto = (index: number) => {
    const localPhotos = newAdditionalPhotoFiles.value
    const target = localPhotos[index]
    if (!target) return
    removeLocalPhotoByKey(target.key)
  }

  const removeExistingPhotoByKey = (key: string) => {
    additionalPhotoItems.value = additionalPhotoItems.value.filter(
      (item) => item.key !== key,
    )
  }

  const handleRemoveExistingPhoto = async (photoId: number) => {
    const photo = existingAdditionalPhotos.value.find(
      (item) => item.id === photoId,
    )
    if (!photo) return

    if (goodsId.value && photo.kind === 'personal') {
      try {
        await ElMessageBox.confirm('确定要删除这张图片吗？', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning',
        })

        await deleteAdditionalPhoto(goodsId.value, photoId)
        removeExistingPhotoByKey(photo.key)
        ElMessage.success('删除成功')
      } catch (err: any) {
        if (err !== 'cancel') {
          ElMessage.error('删除失败：' + (err.message || '未知错误'))
        }
      }
    } else {
      removeExistingPhotoByKey(photo.key)
    }
  }

  const handleRemoveAdditionalPhoto = (item: AdditionalPhotoItem) => {
    if (item.kind === 'local') {
      removeLocalPhotoByKey(item.key)
      return
    }
    void handleRemoveExistingPhoto(item.id)
  }

  const handlePhotoLabelChange = async (photo: ExistingPhoto) => {
    if (photo.kind !== 'personal' || !goodsId.value) return
    if (photo.originalLabel === photo.label) return

    try {
      const label = photo.label.trim()
      await updateAdditionalPhotoLabel(goodsId.value, [photo.id], label)
      photo.originalLabel = label
      ElMessage.success('标签更新成功')
    } catch (err: any) {
      photo.label = photo.originalLabel
      ElMessage.error('标签更新失败：' + (err.message || '未知错误'))
    }
  }

  const moveAdditionalPhoto = (oldIndex: number, newIndex: number) => {
    const items = additionalPhotoItems.value
    if (
      oldIndex === newIndex ||
      oldIndex < 0 ||
      newIndex < 0 ||
      oldIndex >= items.length ||
      newIndex >= items.length
    ) {
      return
    }
    const [moved] = items.splice(oldIndex, 1)
    if (!moved) return
    items.splice(newIndex, 0, moved)
  }

  const findCreatedPhoto = (
    response: GoodsAdditionalPhotosUploadResponse,
    knownIds: Set<number>,
  ) => {
    const explicitCreatedId = response.created_photo_ids?.[0]
    if (explicitCreatedId) {
      const explicit = response.additional_photos.find(
        (photo) => photo.id === explicitCreatedId,
      )
      if (explicit) return explicit
    }
    const created = response.additional_photos.filter(
      (photo) => !knownIds.has(photo.id),
    )
    if (created.length !== 1) {
      throw new Error('上传成功但未返回新增图片 ID')
    }
    return created[0]!
  }

  const handleAdditionalPhotosUpload = async (id: string) => {
    const localPhotos = [...newAdditionalPhotoFiles.value]
    if (localPhotos.length === 0) return

    try {
      for (const photo of localPhotos) {
        const knownIds = new Set(
          additionalPhotoItems.value
            .filter(
              (item): item is PersonalPhoto => item.kind === 'personal',
            )
            .map((item) => item.id),
        )
        const label = photo.label.trim()
        const response = await uploadAdditionalPhotos(id, [photo.file], {
          label,
          clientUploadId: photo.clientUploadId,
        })
        const created = findCreatedPhoto(response, knownIds)

        const itemIndex = additionalPhotoItems.value.findIndex(
          (item) => item.key === photo.key && item.kind === 'local',
        )
        if (itemIndex < 0) continue

        additionalPhotoItems.value.splice(
          itemIndex,
          1,
          toPersonalPhoto(
            {
              ...created,
              label: created.label ?? label,
            },
            photo.key,
          ),
        )
        revokePreview(photo)
      }
    } catch (err: any) {
      ElMessage.error('上传附件图片失败：' + (err.message || '未知错误'))
      throw err
    }
  }

  const getClubSourcePhotoIdsInDisplayOrder = () => (
    additionalPhotoItems.value
      .filter(
        (item): item is ClubSourcePhoto => item.kind === 'club-source',
      )
      .map((item) => item.id)
  )

  const getClubSourcePhotoLabelOverrides = () => Object.fromEntries(
    additionalPhotoItems.value
      .filter(
        (item): item is ClubSourcePhoto => item.kind === 'club-source',
      )
      .filter((item) => item.originalLabel !== item.label)
      .map((item) => [String(item.id), item.label]),
  )

  const hydrateMergedPhotos = (photos: GuziImage[]) => {
    const localPhotos = additionalPhotoItems.value.filter(
      (item): item is NewPhotoFile => item.kind === 'local',
    )
    additionalPhotoItems.value = [
      ...photos.map((photo) => toPersonalPhoto(photo)),
      ...localPhotos,
    ]
  }

  const adoptClubSourcePhotos = (
    photos: GuziImage[],
    orderedSourcePhotoIds: number[],
  ) => {
    const sourcePhotos = additionalPhotoItems.value.filter(
      (item): item is ClubSourcePhoto => item.kind === 'club-source',
    )
    if (sourcePhotos.length === 0) return
    if (photos.length !== orderedSourcePhotoIds.length) {
      throw new Error('导入后的附件图片数量不一致')
    }

    const replacements = new Map<string, PersonalPhoto>()
    orderedSourcePhotoIds.forEach((sourcePhotoId, index) => {
      const copied = photos[index]
      if (!copied) return
      const source = sourcePhotos.find((item) => item.id === sourcePhotoId)
      if (!source) return
      replacements.set(source.key, toPersonalPhoto({
        ...copied,
        label: copied.label ?? source.label,
      }, source.key))
    })

    additionalPhotoItems.value = additionalPhotoItems.value.map((item) =>
      item.kind === 'club-source'
        ? replacements.get(item.key) || item
        : item,
    )
  }

  const persistAdditionalPhotoOrder = async (id: string) => {
    const photoIds = additionalPhotoItems.value
      .filter(
        (item): item is PersonalPhoto => item.kind === 'personal',
      )
      .map((item) => item.id)

    if (photoIds.length < 2) return
    await reorderAdditionalPhotos(id, photoIds)
  }

  const setExistingPhotos = (
    photos: ExistingPhotoInput[],
    options: SetExistingPhotosOptions = {},
  ) => {
    additionalPhotoItems.value.forEach((item) => {
      if (item.kind === 'local') revokePreview(item)
    })

    const kind = options.kind || 'personal'
    additionalPhotoItems.value = photos.map((photo, index) => {
      const label = photo.label || ''
      if (kind === 'club-source') {
        return {
          kind: 'club-source',
          key: `club-source-${photo.id}-${index}`,
          id: photo.id,
          image: photo.image,
          order: photo.order ?? index + 1,
          sourceIndex: index,
          label,
          originalLabel: label,
        }
      }
      return toPersonalPhoto({
        id: photo.id,
        image: photo.image,
        label,
        order: photo.order ?? index + 1,
      })
    })
    additionalPhotoList.value = []
  }

  const resetNewPhotos = () => {
    additionalPhotoItems.value = additionalPhotoItems.value.filter((item) => {
      if (item.kind !== 'local') return true
      revokePreview(item)
      return false
    })
    additionalPhotoList.value = []
  }

  const cleanupNewPhotos = () => {
    newAdditionalPhotoFiles.value.forEach(revokePreview)
  }

  return {
    additionalPhotoItems,
    existingAdditionalPhotos,
    newAdditionalPhotoFiles,
    additionalPhotoPreviewSources,
    additionalPhotoList,
    handleAdditionalPhotoChange,
    addNewPhotoFile,
    handleAdditionalPhotoRemove,
    handleRemoveNewPhoto,
    handleRemoveAdditionalPhoto,
    handleRemoveExistingPhoto,
    handlePhotoLabelChange,
    moveAdditionalPhoto,
    handleAdditionalPhotosUpload,
    getClubSourcePhotoIdsInDisplayOrder,
    getClubSourcePhotoLabelOverrides,
    hydrateMergedPhotos,
    adoptClubSourcePhotos,
    persistAdditionalPhotoOrder,
    setExistingPhotos,
    resetNewPhotos,
    cleanupNewPhotos,
  }
}
