/**
 * Clear's the in-game console
*/
export function clear() {
	console.log(
		"<script>angular.element(document.getElementsByClassName('fa fa-trash ng-scope')[0].parentNode).scope().Console.clear()</script>"
	)
}
