import { Route, Routes } from 'react-router-dom'

import { Layout } from '@/components/Layout'
import { ConfirmQualitiesPage } from '@/pages/ConfirmQualitiesPage'
import { HomePage } from '@/pages/HomePage'
import { MatchingPage } from '@/pages/MatchingPage'
import { MatchResultPage } from '@/pages/MatchResultPage'
import { StoryMapPage } from '@/pages/StoryMapPage'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/confirm" element={<ConfirmQualitiesPage />} />
        <Route path="/matching" element={<MatchingPage />} />
        <Route path="/result" element={<MatchResultPage />} />
        <Route path="/story/:placeId" element={<StoryMapPage />} />
      </Routes>
    </Layout>
  )
}
