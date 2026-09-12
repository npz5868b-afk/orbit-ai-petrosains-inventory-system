export type StorePhotoAsset = {
  src: string
  alt: string
}

export type StorePhotoSet = {
  hero: StorePhotoAsset
  environment: StorePhotoAsset[]
}

const storePhotoSets: Record<string, StorePhotoSet> = {
  'store-1': {
    hero: {
      src: '/storerooms/Store1_HERO.jpg',
      alt: 'Store 1 Store Level 4 storeroom hero photo',
    },
    environment: [
      {
        src: '/storerooms/Store1_ENVIRONMENT_1.jpg',
        alt: 'Store 1 Store Level 4 environment photo 1',
      },
      {
        src: '/storerooms/Store1_ENVIRONMENT_2.jpg',
        alt: 'Store 1 Store Level 4 environment photo 2',
      },
      {
        src: '/storerooms/Store1_ENVIRONMENT_3.jpg',
        alt: 'Store 1 Store Level 4 environment photo 3',
      },
    ],
  },
  'store-2': {
    hero: {
      src: '/storerooms/Store2_HERO.jpg',
      alt: 'Store 2 Edustore storeroom hero photo',
    },
    environment: [
      {
        src: '/storerooms/Store2_ENVIRONMENT_1.jpg',
        alt: 'Store 2 Edustore environment photo 1',
      },
      {
        src: '/storerooms/Store2_ENVIRONMENT_2.jpg',
        alt: 'Store 2 Edustore environment photo 2',
      },
      {
        src: '/storerooms/Store2_ENVIRONMENT_3.jpg',
        alt: 'Store 2 Edustore environment photo 3',
      },
    ],
  },
  'store-3': {
    hero: {
      src: '/storerooms/Store3_HERO.jpg',
      alt: 'Store 3 Chemical Room hero photo',
    },
    environment: [
      {
        src: '/storerooms/Store3_ENVIRONMENT_1.jpg',
        alt: 'Store 3 Chemical Room environment photo 1',
      },
      {
        src: '/storerooms/Store3_ENVIRONMENT_2.jpg',
        alt: 'Store 3 Chemical Room environment photo 2',
      },
      {
        src: '/storerooms/Store3_ENVIRONMENT_3.jpg',
        alt: 'Store 3 Chemical Room environment photo 3',
      },
    ],
  },
  'store-4': {
    hero: {
      src: '/storerooms/Store4_HERO.jpg',
      alt: 'Store 4 Store Concourse hero photo',
    },
    environment: [
      {
        src: '/storerooms/Store4_ENVIRONMENT_1.jpg',
        alt: 'Store 4 Store Concourse environment photo 1',
      },
      {
        src: '/storerooms/Store4_ENVIRONMENT_2.jpg',
        alt: 'Store 4 Store Concourse environment photo 2',
      },
    ],
  },
}

export function getStorePhotoSet(storeId: string) {
  return storePhotoSets[storeId] ?? null
}
