import { lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import ScrollToTopOnRouteChange from '@hocs/withScrollTopOnRouteChange';
import withLazyLoadably from '@hocs/withLazyLoadably';

import MainLayout from '@/components/layouts/mainLayout';

const RecipeHome = withLazyLoadably(lazy(() => import('@/pages/recipes')));
const SamplePage = withLazyLoadably(lazy(() => import('@/pages/sample')));

function Router() {
	return (
		<BrowserRouter basename="/CookingWebsite">
			<ScrollToTopOnRouteChange>
				<Routes>
					<Route path="/" element={<RecipeHome />} />
					<Route path="/samplePage" element={<MainLayout />}>
						<Route index element={<SamplePage />} />
					</Route>
				</Routes>
			</ScrollToTopOnRouteChange>
		</BrowserRouter>
	);
}

export default Router;
