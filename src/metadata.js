const CHURCH_FOOTER = '\n---\nPacific Crossroads Church | pacificcrossroads.org'

export function buildDescription(item, libraryEntry) {
  const parts = []

  if (item.series?.title) {
    parts.push(`Part of the "${item.series.title}" series`)
  }

  if (libraryEntry?.speaker) {
    parts.push(`Speaker: ${libraryEntry.speaker}`)
  }

  if (libraryEntry?.scriptures?.length > 0) {
    parts.push(`Scripture: ${libraryEntry.scriptures.join(', ')}`)
  }

  if (libraryEntry?.summary) {
    const plainText = libraryEntry.summary.replaceAll(/<[^>]*>/g, '').trim()
    if (plainText) {
      parts.push(`\n${plainText}`)
    }
  }

  parts.push(CHURCH_FOOTER)

  return parts.join('\n')
}

export function buildTags(libraryEntry) {
  const tags = ['sermon', 'church', 'Pacific Crossroads Church']

  if (libraryEntry?.speaker) {
    tags.push(libraryEntry.speaker)
  }

  if (libraryEntry?.tags) {
    for (const tag of libraryEntry.tags) {
      // Tags are in format "speaker:Name" - extract the value
      const value = tag.includes(':') ? tag.split(':').slice(1).join(':') : tag
      if (!tags.includes(value)) {
        tags.push(value)
      }
    }
  }

  if (libraryEntry?.scriptures) {
    for (const scripture of libraryEntry.scriptures) {
      tags.push(scripture)
    }
  }

  return tags
}

export function buildVideoMetadata(item, libraryEntry) {
  return {
    snippet: {
      title: item.title,
      description: buildDescription(item, libraryEntry),
      tags: buildTags(libraryEntry),
      categoryId: '29', // Nonprofits & Activism
    },
    status: {
      privacyStatus: 'private',
      selfDeclaredMadeForKids: false,
    },
    recordingDetails: {
      recordingDate: item.date,
    },
  }
}

export function getThumbnailFilename(item) {
  // Priority: image_wide > image_banner > thumbnail_01
  if (item.files?.image_wide) {
    return item.files.image_wide.filename
  }

  if (item.files?.image_banner) {
    return item.files.image_banner.filename
  }

  if (item.files?.thumbnail_01) {
    return item.files.thumbnail_01.filename
  }

  return null
}
