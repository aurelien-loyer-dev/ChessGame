import { lazy, Suspense } from 'react';
import { Board, type BoardProps } from '../board/Board';
import { useSettings } from '../../store/settings';

const Board3D = lazy(() => import('../../three/Board3D'));

/** Renders the 2D board or the 3D scene depending on the user's setting. */
export function BoardView(props: BoardProps & { allow3d?: boolean }) {
  const view3d = useSettings((s) => s.view3d);
  const { allow3d = true, ...rest } = props;
  if (view3d && allow3d) {
    return (
      <Suspense fallback={<Board {...rest} />}>
        <Board3D {...rest} />
      </Suspense>
    );
  }
  return <Board {...rest} />;
}
